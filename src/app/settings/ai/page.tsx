import { prisma } from '@/lib/db'
import { AiSettingsForm } from '@/components/ai-settings-form'

export default async function AiSettingsPage() {
  const [provider, model] = await Promise.all([
    prisma.setting.findUnique({ where: { key: 'AI_PROVIDER' } }),
    prisma.setting.findUnique({ where: { key: 'AI_MODEL' } }),
  ])

  return (
    <div className="max-w-lg">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">AI Provider</h1>
        <p className="text-sm text-gray-500 mt-0.5">
          Choose which API provider and model to use for post analysis
        </p>
      </div>

      <div className="bg-white border rounded-lg p-5">
        <AiSettingsForm
          initialProvider={provider?.value ?? 'openai'}
          initialModel={model?.value ?? 'gpt-4o'}
        />
      </div>

      <div className="mt-6 text-xs text-gray-400 space-y-1">
        <p>Requires the corresponding API key in your <code className="font-mono bg-gray-100 px-1 rounded">.env</code> file:</p>
        <ul className="list-disc pl-4 space-y-0.5">
          <li><strong>openai</strong> — <code className="font-mono">OPENAI_API_KEY</code></li>
          <li><strong>openrouter</strong> — <code className="font-mono">OPENROUTER_API_KEY</code></li>
          <li><strong>groq</strong> — <code className="font-mono">GROQ_API_KEY</code></li>
        </ul>
      </div>
    </div>
  )
}
