'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

interface Keyword {
  id: string
  word: string
}

export function BlockedKeywordList({ initial }: { initial: Keyword[] }) {
  const router = useRouter()
  const [keywords, setKeywords] = useState(initial)
  const [newWord, setNewWord] = useState('')
  const [adding, setAdding] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleAdd() {
    const word = newWord.trim()
    if (!word) return
    setAdding(true)
    setError(null)
    try {
      const res = await fetch('/api/settings/blocked-keywords', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ word }),
      })
      if (!res.ok) {
        const data = await res.json()
        setError(data.error ?? 'Failed to add keyword')
        return
      }
      const created = await res.json()
      setKeywords(prev => [...prev, created].sort((a, b) => a.word.localeCompare(b.word)))
      setNewWord('')
      router.refresh()
    } catch {
      setError('Network error')
    } finally {
      setAdding(false)
    }
  }

  async function handleDelete(id: string) {
    try {
      await fetch(`/api/settings/blocked-keywords/${id}`, { method: 'DELETE' })
      setKeywords(prev => prev.filter(k => k.id !== id))
      router.refresh()
    } catch {
      // silent
    }
  }

  return (
    <div className="bg-white border rounded-lg overflow-hidden">
      <ul className="divide-y">
        {keywords.length === 0 && (
          <li className="px-4 py-6 text-sm text-gray-400 text-center">No filter words yet</li>
        )}
        {keywords.map(k => (
          <li key={k.id} className="px-4 py-2.5 flex items-center justify-between">
            <span className="text-sm font-mono text-gray-800">{k.word}</span>
            <button
              onClick={() => handleDelete(k.id)}
              className="text-xs text-gray-400 hover:text-red-500 transition-colors cursor-pointer"
            >
              Remove
            </button>
          </li>
        ))}
      </ul>
      <div className="px-4 py-3 border-t bg-gray-50 flex gap-2">
        <Input
          value={newWord}
          onChange={e => setNewWord(e.target.value)}
          placeholder="e.g. [For Hire]"
          className="text-sm h-8 flex-1"
          onKeyDown={e => e.key === 'Enter' && handleAdd()}
        />
        <Button onClick={handleAdd} disabled={adding || !newWord.trim()} size="sm" className="h-8">
          {adding ? 'Adding…' : 'Add'}
        </Button>
      </div>
      {error && <p className="px-4 pb-2 text-xs text-red-500">{error}</p>}
    </div>
  )
}
