'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { useRouter } from 'next/navigation'

export function PipelineButtons() {
  const router = useRouter()
  const [fetchLoading, setFetchLoading] = useState(false)
  const [analyzeLoading, setAnalyzeLoading] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  async function handleFetch() {
    setFetchLoading(true)
    setMessage(null)
    try {
      const res = await fetch('/api/fetch-posts', { method: 'POST' })
      const data = await res.json()
      if (data.subreddits?.length > 0) {
        let msg = `Fetched ${data.fetched} posts from ${data.subreddits.join(', ')}`
        if (data.skipped > 0) msg += ` (${data.skipped} filtered)`
        setMessage(msg)
      } else {
        setMessage('No subreddits due for fetching')
      }
      router.refresh()
    } catch {
      setMessage('Failed to fetch posts')
    } finally {
      setFetchLoading(false)
    }
  }

  async function handleAnalyze() {
    setAnalyzeLoading(true)
    setMessage(null)
    try {
      const res = await fetch('/api/analyze', { method: 'POST' })
      const data = await res.json()
      setMessage(`Analyzed ${data.analyzed} posts`)
      router.refresh()
    } catch {
      setMessage('Failed to analyze posts')
    } finally {
      setAnalyzeLoading(false)
    }
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <div className="flex gap-2">
        <Button onClick={handleFetch} disabled={fetchLoading} variant="outline" size="sm">
          {fetchLoading ? 'Fetching…' : 'Refresh Reddit'}
        </Button>
        <Button onClick={handleAnalyze} disabled={analyzeLoading} size="sm">
          {analyzeLoading ? 'Analyzing…' : 'Analyze Posts'}
        </Button>
      </div>
      {message && <p className="text-xs text-gray-500">{message}</p>}
    </div>
  )
}
