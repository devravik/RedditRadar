'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'

const PROVIDERS = [
  { value: 'openai', label: 'OpenAI' },
  { value: 'openrouter', label: 'OpenRouter' },
  { value: 'groq', label: 'Groq' },
]

const MODEL_PRESETS: Record<string, string[]> = {
  openai: ['gpt-4o', 'gpt-4o-mini', 'gpt-4-turbo'],
  openrouter: ['openai/gpt-4o', 'anthropic/claude-3.5-sonnet', 'meta-llama/llama-3.3-70b-instruct'],
  groq: ['llama-3.3-70b-versatile', 'llama-3.1-8b-instant', 'mixtral-8x7b-32768'],
}

export function AiSettingsForm({
  initialProvider,
  initialModel,
}: {
  initialProvider: string
  initialModel: string
}) {
  const [provider, setProvider] = useState(initialProvider)
  const [model, setModel] = useState(initialModel)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  async function handleSave() {
    setSaving(true)
    setMessage(null)
    try {
      const res = await fetch('/api/settings/ai', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ provider, model }),
      })
      if (res.ok) {
        const data = await res.json()
        setProvider(data.provider)
        setModel(data.model)
        setMessage(`Saved - ${data.provider} / ${data.model}`)
      } else {
        const data = await res.json()
        setMessage(data.error ?? 'Failed to save')
      }
    } catch {
      setMessage('Network error')
    } finally {
      setSaving(false)
    }
  }

  const presets = MODEL_PRESETS[provider] ?? []

  return (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Provider</label>
        <select
          value={provider}
          onChange={e => { setProvider(e.target.value); setModel(presets[0] ?? '') }}
          className="w-full text-sm border rounded px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-gray-400"
        >
          {PROVIDERS.map(p => (
            <option key={p.value} value={p.value}>{p.label}</option>
          ))}
        </select>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Model</label>
        <div className="flex gap-2 flex-wrap mb-2">
          {presets.map(m => (
            <button
              key={m}
              type="button"
              onClick={() => setModel(m)}
              className={`text-xs px-2 py-1 rounded border ${model === m
                  ? 'bg-gray-900 text-white border-gray-900'
                  : 'bg-white text-gray-600 border-gray-200 hover:border-gray-400'
                }`}
            >
              {m}
            </button>
          ))}
        </div>
        <input
          value={model}
          onChange={e => setModel(e.target.value)}
          placeholder="Or type a custom model name…"
          className="w-full text-sm border rounded px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-gray-400"
        />
      </div>

      <div className="flex items-center gap-3">
        <Button onClick={handleSave} disabled={saving} size="sm">
          {saving ? 'Saving…' : 'Save'}
        </Button>
        {message && <span className="text-xs text-gray-500">{message}</span>}
      </div>
    </div>
  )
}
