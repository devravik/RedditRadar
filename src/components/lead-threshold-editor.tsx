'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

export function LeadThresholdEditor({ initialThreshold }: { initialThreshold: number }) {
  const [threshold, setThreshold] = useState(String(initialThreshold))
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  async function handleSave() {
    setSaving(true)
    setMessage(null)
    try {
      const res = await fetch('/api/settings/lead-threshold', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ threshold: parseInt(threshold, 10) }),
      })
      if (res.ok) {
        const data = await res.json()
        setThreshold(String(data.threshold))
        setMessage(`Saved - auto-lead at score ≥ ${data.threshold}`)
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

  return (
    <div className="flex items-center gap-3 flex-wrap">
      <Input
        value={threshold}
        onChange={e => setThreshold(e.target.value)}
        type="number"
        min="0"
        max="100"
        className="w-20 text-sm h-8"
      />
      <span className="text-sm text-gray-500">or higher</span>
      <Button onClick={handleSave} disabled={saving || !threshold.trim()} size="sm" className="h-8">
        {saving ? 'Saving…' : 'Save'}
      </Button>
      {message && <span className="text-xs text-gray-500">{message}</span>}
    </div>
  )
}
