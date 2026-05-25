'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

export function SenderNameEditor({ initialName }: { initialName: string }) {
  const [name, setName] = useState(initialName)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  async function handleSave() {
    setSaving(true)
    setMessage(null)
    try {
      const res = await fetch('/api/settings/sender-name', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name }),
      })
      if (res.ok) {
        setMessage('Saved')
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
        value={name}
        onChange={e => setName(e.target.value)}
        placeholder="Your name or handle"
        className="w-64 text-sm h-8"
      />
      <Button onClick={handleSave} disabled={saving} size="sm" className="h-8">
        {saving ? 'Saving…' : 'Save'}
      </Button>
      {message && <span className="text-xs text-gray-500">{message}</span>}
    </div>
  )
}
