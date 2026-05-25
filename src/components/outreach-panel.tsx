'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { MessageType } from '@/types'

interface Props {
  leadId: string
  existingMessages: Array<{ id: string; type: MessageType; content: string }>
}

export function OutreachPanel({ leadId, existingMessages }: Props) {
  const [type, setType] = useState<MessageType>('REDDIT_DM')
  const [message, setMessage] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [saved, setSaved] = useState(existingMessages)

  async function generate() {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/generate-message', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ leadId, type }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Unknown error' }))
        setError(err.error ?? 'Failed to generate message')
        return
      }
      const data = await res.json()
      setMessage(data.content)
      setSaved(prev => [data, ...prev])
    } catch {
      setError('Network error - could not generate message')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-4">
      {error && <p className="text-sm text-red-600">{error}</p>}
      <div className="flex gap-2 items-center">
        <Select value={type} onValueChange={v => setType(v as MessageType)}>
          <SelectTrigger className="w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="REDDIT_DM">Reddit DM</SelectItem>
            <SelectItem value="EMAIL">Email</SelectItem>
            <SelectItem value="LINKEDIN">LinkedIn</SelectItem>
          </SelectContent>
        </Select>
        <Button onClick={generate} disabled={loading} size="sm">
          {loading ? 'Generating…' : 'Generate'}
        </Button>
      </div>

      {message && (
        <div>
          <Textarea
            value={message}
            onChange={e => setMessage(e.target.value)}
            rows={8}
            className="font-mono text-sm"
          />
          <Button
            variant="outline"
            size="sm"
            className="mt-2"
            onClick={() => navigator.clipboard.writeText(message)}
          >
            Copy
          </Button>
        </div>
      )}

      {saved.length > 0 && (
        <div>
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">Previous Messages</p>
          <div className="space-y-2">
            {saved.map(m => (
              <div key={m.id} className="text-sm bg-gray-50 border rounded p-3">
                <span className="text-xs font-medium text-gray-400 block mb-1">{m.type}</span>
                <p className="whitespace-pre-wrap text-gray-700">{m.content}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
