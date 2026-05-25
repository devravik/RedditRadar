'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export function FetchSubredditButton({ name }: { name: string }) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  async function handleClick() {
    setLoading(true)
    setMessage(null)
    try {
      const res = await fetch(`/api/fetch-posts/${encodeURIComponent(name)}`, { method: 'POST' })
      const data = await res.json()
      if (res.ok) {
        setMessage(`+${data.fetched}`)
      } else {
        setMessage(data.error ?? 'Error')
      }
      router.refresh()
    } catch {
      setMessage('Error')
    } finally {
      setLoading(false)
      setTimeout(() => setMessage(null), 3000)
    }
  }

  return (
    <button
      onClick={handleClick}
      disabled={loading}
      className="text-xs text-gray-400 hover:text-gray-700 disabled:opacity-50 transition-colors"
      title="Fetch posts now"
    >
      {loading ? '…' : message ?? 'fetch'}
    </button>
  )
}
