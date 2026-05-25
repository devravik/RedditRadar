'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { useRouter } from 'next/navigation'
import Swal from 'sweetalert2'

export function PipelineButtons() {
  const router = useRouter()
  const [fetchLoading, setFetchLoading] = useState(false)
  const [analyzeLoading, setAnalyzeLoading] = useState(false)

  async function handleFetch() {
    setFetchLoading(true)
    try {
      const res = await fetch('/api/fetch-posts', { method: 'POST' })
      const data = await res.json()
      if (data.subreddits?.length > 0) {
        let msg = `Fetched ${data.fetched} posts from ${data.subreddits.join(', ')}`
        if (data.skipped > 0) msg += ` (${data.skipped} filtered)`
        Swal.fire({ icon: 'success', title: msg, toast: true, position: 'top-end', timer: 3000, showConfirmButton: false })
      } else {
        Swal.fire({ icon: 'info', title: 'No subreddits due for fetching', toast: true, position: 'top-end', timer: 2500, showConfirmButton: false })
      }
      router.refresh()
    } catch {
      Swal.fire({ icon: 'error', title: 'Failed to fetch posts', toast: true, position: 'top-end', timer: 3000, showConfirmButton: false })
    } finally {
      setFetchLoading(false)
    }
  }

  async function handleAnalyze() {
    setAnalyzeLoading(true)
    try {
      const res = await fetch('/api/analyze', { method: 'POST' })
      const data = await res.json()
      let msg = `Analyzed ${data.analyzed} posts`
      if (data.preFiltered > 0) msg += ` (${data.preFiltered} pre-filtered)`
      Swal.fire({ icon: 'success', title: msg, toast: true, position: 'top-end', timer: 3000, showConfirmButton: false })
      router.refresh()
    } catch {
      Swal.fire({ icon: 'error', title: 'Failed to analyze posts', toast: true, position: 'top-end', timer: 3000, showConfirmButton: false })
    } finally {
      setAnalyzeLoading(false)
    }
  }

  return (
    <div className="flex gap-2">
      <Button onClick={handleFetch} disabled={fetchLoading} variant="outline" size="sm">
        {fetchLoading ? 'Fetching…' : 'Refresh Reddit'}
      </Button>
      <Button onClick={handleAnalyze} disabled={analyzeLoading} size="sm">
        {analyzeLoading ? 'Analyzing…' : 'Analyze Posts'}
      </Button>
    </div>
  )
}
