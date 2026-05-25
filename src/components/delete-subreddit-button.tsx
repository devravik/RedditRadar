'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Swal from 'sweetalert2'

export function DeleteSubredditButton({ id, name }: { id: string; name: string }) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)

  async function handleDelete() {
    const result = await Swal.fire({
      title: 'Remove subreddit?',
      text: `r/${name} will be removed and its posts will remain in the database.`,
      icon: 'question',
      showCancelButton: true,
      confirmButtonText: 'Remove',
      cancelButtonText: 'Cancel',
      confirmButtonColor: '#dc2626',
    })

    if (!result.isConfirmed) return

    setLoading(true)
    try {
      await fetch(`/api/subreddits/${id}`, { method: 'DELETE' })
      Swal.fire({
        icon: 'success',
        title: 'Removed',
        text: `r/${name} removed`,
        toast: true,
        position: 'top-end',
        timer: 2500,
        showConfirmButton: false,
      })
      router.refresh()
    } catch {
      Swal.fire({
        icon: 'error',
        title: 'Failed',
        text: `Could not remove r/${name}`,
        toast: true,
        position: 'top-end',
        timer: 3000,
        showConfirmButton: false,
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <button
      onClick={handleDelete}
      disabled={loading}
      className="text-xs text-gray-400 hover:text-red-500 disabled:opacity-50 transition-colors cursor-pointer"
    >
      {loading ? 'Removing…' : 'Remove'}
    </button>
  )
}
