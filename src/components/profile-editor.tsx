'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'

export function ProfileEditor({ initial }: { initial: string }) {
  const [profile, setProfile] = useState(initial)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  async function handleSave() {
    setSaving(true)
    setMessage(null)
    try {
      const res = await fetch('/api/settings/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ profile }),
      })
      if (res.ok) {
        setMessage('Profile saved')
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
    <div className="space-y-3">
      <textarea
        value={profile}
        onChange={e => setProfile(e.target.value)}
        rows={10}
        className="w-full border rounded-lg p-3 text-sm font-mono text-gray-800 focus:outline-none focus:ring-1 focus:ring-gray-400 resize-y"
      />
      <div className="flex items-center gap-3">
        <Button onClick={handleSave} disabled={saving} size="sm">
          {saving ? 'Saving…' : 'Save Profile'}
        </Button>
        {message && <span className="text-xs text-gray-500">{message}</span>}
      </div>
    </div>
  )
}
