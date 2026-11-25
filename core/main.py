from pathlib import Path
from uuid import uuid4
import threading

import torch
import soundfile as sf

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from pydantic import BaseModel, Field
from qwen_tts import Qwen3TTSModel


app = FastAPI(title="Qwen TTS Studio API")

BASE_DIR = Path(__file__).resolve().parents[2]
MODEL_DIR = BASE_DIR.parent / "models"
OUTPUT_DIR = BASE_DIR / "outputs"

OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


MODEL_REGISTRY = {
    "0.6B CustomVoice": {
        "folder": "Qwen3-TTS-12Hz-0.6B-CustomVoice",
        "type": "custom_voice",
    },
    "1.7B CustomVoice": {
        "folder": "Qwen3-TTS-12Hz-1.7B-CustomVoice",
        "type": "custom_voice",
    },
    "0.6B Base": {
        "folder": "Qwen3-TTS-12Hz-0.6B-Base",
        "type": "base",
    },
    "1.7B Base": {
        "folder": "Qwen3-TTS-12Hz-1.7B-Base",
        "type": "base",
    },
    "1.7B VoiceDesign": {
        "folder": "Qwen3-TTS-12Hz-1.7B-VoiceDesign",
        "type": "voice_design",
    },
}


loaded_model = None
loaded_model_name = None
model_lock = threading.Lock()

class GenerateRequest(BaseModel):
    text: str = Field(min_length=1, max_length=5000)
    model: str
    language: str = "Auto"
    speaker: str = ""


def get_model(model_name: str):
    global loaded_model, loaded_model_name

    if model_name not in MODEL_REGISTRY:
        raise HTTPException(status_code=400, detail="Unknown model")

    model_path = MODEL_DIR / MODEL_REGISTRY[model_name]["folder"]

    if not model_path.is_dir():
        raise HTTPException(
            status_code=404,
            detail=f"Model not installed: {model_name}",
        )

    # Prevent accidental Hugging Face downloads.
    if not (model_path / "config.json").exists():
        raise HTTPException(
            status_code=400,
            detail="Model folder is missing config.json",
        )

    if loaded_model is not None and loaded_model_name == model_name:
        return loaded_model

    if loaded_model is not None:
        del loaded_model
        loaded_model = None
        loaded_model_name = None

        if torch.cuda.is_available():
            torch.cuda.empty_cache()

    device = "cuda:0" if torch.cuda.is_available() else "cpu"
    dtype = torch.float16 if device.startswith("cuda") else torch.float32

    try:
        loaded_model = Qwen3TTSModel.from_pretrained(
            str(model_path),
            device_map=device,
            dtype=dtype,
        )

        loaded_model_name = model_name

        return loaded_model

    except Exception as e:
        loaded_model = None
        loaded_model_name = None

        raise HTTPException(
            status_code=500,
            detail=f"Failed to load model: {str(e)}",
        )


@app.get("/")
def root():
    return {
        "app": "Qwen TTS",
        "status": "running",
    }


@app.get("/api/models")
def get_models():
    models = []

    for name, info in MODEL_REGISTRY.items():
        model_path = MODEL_DIR / info["folder"]

        models.append({
            "name": name,
            "folder": info["folder"],
            "type": info["type"],
            "path": str(model_path),
            "installed": (
                model_path.is_dir()
                and (model_path / "config.json").exists()
            ),
        })

    return {
        "models_directory": str(MODEL_DIR),
        "models": models,
    }


@app.get("/api/models/{model_name}/speakers")
def get_speakers(model_name: str):
    if MODEL_REGISTRY.get(model_name, {}).get("type") != "custom_voice":
        raise HTTPException(
            status_code=400,
            detail="Speaker listing is currently only available for Custom Voice models.",
        )

    with model_lock:
        model = get_model(model_name)

        try:
            speakers = model.get_supported_speakers()
            return {"speakers": speakers}
        except Exception as e:
            raise HTTPException(
                status_code=500,
                detail=f"Failed to retrieve speakers: {str(e)}",
            )


@app.post("/api/generate")
def generate(request: GenerateRequest):
    model_type = MODEL_REGISTRY.get(request.model, {}).get("type")

    if model_type != "custom_voice":
        raise HTTPException(
            status_code=400,
            detail="This generation endpoint currently supports Custom Voice models only.",
        )

    if not request.text.strip():
        raise HTTPException(status_code=400, detail="Text cannot be empty")

    with model_lock:
        model = get_model(request.model)

        try:
            speakers = model.get_supported_speakers() or []

            selected_speaker = request.speaker.strip()

            if not selected_speaker:
                raise HTTPException(
                    status_code=400,
                    detail="Please select a speaker.",
                )

            if selected_speaker not in speakers:
                raise HTTPException(
                    status_code=400,
                    detail="Invalid speaker for the selected model.",
                )

            # The 0.6B CustomVoice model does not support instruct.
            wavs, sample_rate = model.generate_custom_voice(
                text=request.text,
                language=request.language,
                speaker=request.speaker,
            )

            output_path = OUTPUT_DIR / f"{uuid4().hex}.wav"

            sf.write(output_path, wavs[0], sample_rate)

            return FileResponse(
                path=output_path,
                media_type="audio/wav",
                filename=output_path.name,
            )

        except HTTPException:
            raise

        except Exception as e:
            raise HTTPException(
                status_code=500,
                detail=f"Generation failed: {str(e)}",
            )