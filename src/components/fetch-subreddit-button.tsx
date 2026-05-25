'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Swal from 'sweetalert2'

export function FetchSubredditButton({ name }: { name: string }) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)

  async function handleClick() {
    setLoading(true)
    try {
      const res = await fetch(`/api/fetch-posts/${encodeURIComponent(name)}`, { method: 'POST' })
      const data = await res.json()
      if (res.ok) {
        Swal.fire({
          icon: 'success',
          title: `+${data.fetched} posts from r/${name}`,
          toast: true,
          position: 'top-end',
          timer: 2500,
          showConfirmButton: false,
        })
      } else {
        Swal.fire({
          icon: 'error',
          title: data.error ?? 'Fetch failed',
          toast: true,
          position: 'top-end',
          timer: 3000,
          showConfirmButton: false,
        })
      }
      router.refresh()
    } catch {
      Swal.fire({ icon: 'error', title: 'Fetch failed', toast: true, position: 'top-end', timer: 3000, showConfirmButton: false })
    } finally {
      setLoading(false)
    }
  }

  return (
    <button
      onClick={handleClick}
      disabled={loading}
      className="text-xs text-gray-400 hover:text-gray-700 disabled:opacity-50 transition-colors"
      title="Fetch posts now"
    >
      {loading ? '…' : 'fetch'}
    </button>
  )
}
