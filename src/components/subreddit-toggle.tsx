'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export function SubredditToggle({ id, enabled }: { id: string; enabled: boolean }) {
  const router = useRouter()
  const [value, setValue] = useState(enabled)
  const [loading, setLoading] = useState(false)

  async function toggle() {
    setLoading(true)
    const next = !value
    setValue(next)
    try {
      await fetch(`/api/subreddits/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled: next }),
      })
      router.refresh()
    } catch {
      setValue(!next)
    } finally {
      setLoading(false)
    }
  }

  return (
    <button
      onClick={toggle}
      disabled={loading}
      className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
        value ? 'bg-gray-900' : 'bg-gray-200'
      } ${loading ? 'opacity-50' : ''}`}
      aria-label={value ? 'Disable' : 'Enable'}
    >
      <span
        className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${
          value ? 'translate-x-4' : 'translate-x-1'
        }`}
      />
    </button>
  )
}
