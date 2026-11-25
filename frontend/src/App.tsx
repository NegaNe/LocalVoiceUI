import { useEffect, useState } from 'react'

interface Models {
  name: string
  folder: string
  type: string
  path: string
  installed: boolean
}

interface ModelResponse {
  models_directory: string
  models: Models[]
}

function App() {
  const [models, setModels] = useState<Models[]>([])
  const [selectedModel, setSelectedModel] = useState('')
  const [selectedLanguage, setSelectedLanguage] = useState('Auto')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  
const languages = [
  'Chinese',
  'English',
  'Japanese',
  'Korean',
  'German',
  'French',
  'Russian',
  'Portuguese',
  'Spanish',
  'Italian',
]
// language list officially supported by Qwen


  async function fetchModels() {
    try {
      setLoading(true)
      setError('')

      const response = await fetch('http://127.0.0.1:8000/api/models')


      if (!response.ok) {
        throw new Error('Error fetching models')
      }


      const data: ModelResponse = await response.json()
      setModels(data.models)

      const installedModels = data.models.filter(
        (model) => model.installed,
      )

      if (
        !selectedModel ||
        !installedModels.some((model) => model.name === selectedModel)
      ) {
        setSelectedModel(installedModels[0]?.name ?? '')
      }
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'unkown error occured',
      )
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchModels()
  }, [])

  const installedModels = models.filter((model) => model.installed)

  return (
    <main className="min-h-screen bg-[#0a0a0f] text-gray-100">
      <div className="mx-auto max-w-6xl px-6 py-10">

        <header className="mb-10 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">
              Local QwenTTS
            </h1>

            <p className="mt-1 text-sm text-gray-500">
              Run Qwen TTS model locally
            </p>
          </div>

        </header>

        {/* Main layout */}
        <div className="grid gap-6 md:grid-cols-[1fr_320px]">

          {/* Insert text area*/}
          <section className="rounded-2xl border border-white/10 bg-[#12121a] p-6">

            <div className="mb-4 flex items-center justify-between">
              <h2 className="font-semibold">Text input</h2>

              <span className="text-sm text-gray-500">
                Text to speech
              </span>
            </div>

            <textarea
              placeholder="Enter the text you want to generate..."
              className="h-80 w-full resize-y rounded-xl border border-white/10 bg-[#0a0a0f] p-4 text-gray-200 outline-none transition focus:border-violet-500"
            />

            <div className="mt-4 justify-items-normal">

            {/* Language Select aarea */}
            <div className="mb-4 flex items-center justify-between">
              <h2 className="font-semibold">Select Language</h2>

              <span className="text-sm text-gray-500">
                Text to speech
              </span>
            </div>

            <select
              value={selectedLanguage}
              onChange={(e) => setSelectedLanguage(e.target.value)}
              className="w-full rounded-xl border border-white/10 bg-[#0a0a0f] px-3 py-3 text-sm outline-none focus:border-violet-500"
            >
              <option value="Auto">Auto</option>
              {languages.map((language) => (
                <option key={language} value={language}>
                  {language}
                </option>
              ))}

            </select>
            {/* ed of language select area */}


              <button
                disabled
                className="rounded-xl bg-violet-600 px-5 py-2.5 font-medium text-white opacity-50"
              >
                Generate audio
              </button>
            </div>

          </section>

          <aside className="space-y-6">

            {/* Model selector */}
            <section className="rounded-2xl border border-white/10 bg-[#12121a] p-6">

              <div className="mb-5 flex items-center justify-between">
                <h2 className="font-semibold">Model</h2>

                <button
                  onClick={fetchModels}
                  className="text-sm text-violet-400 transition hover:text-violet-300"
                >
                  Refresh
                </button>
              </div>

              {loading ? (
                <p className="text-sm text-gray-500">
                  Loading models...
                </p>
              ) : error ? (
                <div className="space-y-3">
                  <p className="text-sm text-red-400">{error}</p>

                  <button
                    onClick={fetchModels}
                    className="rounded-lg border border-white/10 px-3 py-2 text-sm hover:bg-white/5"
                  >
                    Retry
                  </button>
                </div>
              ) : installedModels.length === 0 ? (
                <div className="rounded-xl border border-dashed border-white/10 p-4 text-center">
                  <p className="text-sm text-gray-400">
                    No models detected
                  </p>

                  <p className="mt-2 text-xs text-gray-600">
                    Install a model in your models directory.
                  </p>
                </div>
              ) : (
                <div>
                  <label className="mb-2 block text-sm text-gray-400">
                    Installed models
                  </label>

                  <select
                    value={selectedModel}
                    onChange={(e) => setSelectedModel(e.target.value)}
                    className="w-full rounded-xl border border-white/10 bg-[#0a0a0f] px-3 py-3 text-sm outline-none focus:border-violet-500"
                  >
                    {installedModels.map((model) => (
                      <option key={model.name} value={model.name}>
                        {model.name}
                      </option>
                    ))}
                  </select>

                  {selectedModel && (
                    <p className="mt-3 text-xs text-green-400">
                      Model available
                    </p>
                  )}
                </div>
              )}
            </section>

            {/* model lists */}
            <section className="rounded-2xl border border-white/10 bg-[#12121a] p-6">
              <h2 className="mb-4 font-semibold">
                Model library
              </h2>

              <div className="space-y-3">
                {models.map((model) => (
                  <div
                    key={model.name}
                    className="flex items-center justify-between gap-3"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">
                        {model.name}
                      </p>

                      <p className="text-xs text-gray-500">
                        {model.type}
                      </p>
                    </div>

                    <span
                      className={`shrink-0 rounded-full px-2 py-1 text-xs ${
                        model.installed ? 'bg-green-950 text-green-400' : 'bg-gray-900 text-gray-500'
                      }`}
                    >
                      {model.installed ? 'Installed' : 'Missing'}
                    </span>
                  </div>
                ))}
              </div>
            </section>

            {/* <section className="rounded-2xl border border-white/10 bg-[#12121a] p-6">
              <h2 className="mb-3 font-semibold">
                System
              </h2>

              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-500">Backend</span>

                <span className={error ? 'text-red-400' : 'text-green-400'}>
                  {error ? 'Disconnected' : 'Connected'}
                </span>
              </div>

              <div className="mt-3 flex items-center justify-between text-sm">
                <span className="text-gray-500">Installed models</span>

                <span>{installedModels.length}</span>
              </div>
            </section> */}

          </aside>
        </div>
      </div>
    </main>
  )
}

export default App