'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

export function MaxAgeEditor({ initialDays }: { initialDays: number }) {
  const [days, setDays] = useState(String(initialDays))
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  async function handleSave() {
    setSaving(true)
    setMessage(null)
    try {
      const res = await fetch('/api/settings/fetch-age', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ days: parseInt(days, 10) }),
      })
      if (res.ok) {
        const data = await res.json()
        setDays(String(data.days))
        setMessage(`Saved - max age is ${data.days} days`)
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
        value={days}
        onChange={e => setDays(e.target.value)}
        type="number"
        min="1"
        max="365"
        className="w-20 text-sm h-8"
      />
      <span className="text-sm text-gray-500">days</span>
      <Button onClick={handleSave} disabled={saving || !days.trim()} size="sm" className="h-8">
        {saving ? 'Saving…' : 'Save'}
      </Button>
      {message && <span className="text-xs text-gray-500">{message}</span>}
    </div>
  )
}
