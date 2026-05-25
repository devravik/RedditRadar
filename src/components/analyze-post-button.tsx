'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import Swal from 'sweetalert2'

export function AnalyzePostButton({
  postId,
  variant = 'default',
}: {
  postId: string
  variant?: 'default' | 'table'
}) {
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  async function handleClick() {
    setLoading(true)
    try {
      const res = await fetch(`/api/analyze/${postId}`, { method: 'POST' })
      const body = await res.json()
      if (!res.ok) {
        Swal.fire({
          icon: 'error',
          title: 'Analysis failed',
          toast: true,
          position: 'top-end',
          timer: 3000,
          showConfirmButton: false,
        })
        return
      }
      const icon = body.preFiltered ? 'info' as const : 'success' as const
      const title = body.preFiltered ? 'Skipped (pre-filter)' : 'Analysis complete'
      Swal.fire({ icon, title, toast: true, position: 'top-end', timer: 2500, showConfirmButton: false })
      router.refresh()
    } catch {
      Swal.fire({
        icon: 'error',
        title: 'Analysis failed',
        toast: true,
        position: 'top-end',
        timer: 3000,
        showConfirmButton: false,
      })
    } finally {
      setLoading(false)
    }
  }

  if (variant === 'table') {
    return (
      <button
        onClick={handleClick}
        disabled={loading}
        className="text-[11px] text-blue-600 hover:text-blue-800 disabled:text-gray-300 disabled:cursor-not-allowed whitespace-nowrap"
      >
        {loading ? '…' : 'Analyze'}
      </button>
    )
  }

  return (
    <button
      onClick={handleClick}
      disabled={loading}
      className="px-3 py-1.5 text-sm bg-gray-900 text-white rounded hover:bg-gray-800 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
    >
      {loading ? 'Analyzing…' : 'Analyze This Post'}
    </button>
  )
}
