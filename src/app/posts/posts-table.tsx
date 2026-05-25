'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ScoreBadge } from '@/components/score-badge'
import { StatusBadge } from '@/components/status-badge'
import { AnalyzePostButton } from '@/components/analyze-post-button'
import type { LeadStatus } from '@/types'

interface PostRow {
  id: string
  redditId: string
  subreddit: string
  title: string
  author: string
  score: number
  postedAt: Date
  numComments: number
  signal: {
    matchScore: number
    technologies: string[]
    seniority: string
    summary: string
    analyzedAt: Date
  } | null
  lead: { id: string; status: LeadStatus } | null
}

export default function PostsTable({
  posts,
  total,
  page,
  totalPages,
  searchParams,
  sortKey,
  sortOrder,
}: {
  posts: PostRow[]
  total: number
  page: number
  totalPages: number
  searchParams: Record<string, string | undefined>
  sortKey: string
  sortOrder: 'asc' | 'desc'
}) {
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [analyzing, setAnalyzing] = useState(false)
  const [result, setResult] = useState<string | null>(null)
  const router = useRouter()

  function toggle(id: string) {
    setSelected(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function toggleAll() {
    if (selected.size === posts.filter(p => !p.signal).length) {
      setSelected(new Set())
    } else {
      setSelected(new Set(posts.filter(p => !p.signal).map(p => p.id)))
    }
  }

  async function analyzeSelected() {
    const ids = Array.from(selected)
    if (ids.length === 0) return

    setAnalyzing(true)
    setResult(null)
    try {
      const res = await fetch('/api/analyze/batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ postIds: ids }),
      })
      const data = await res.json()
      setResult(`Analyzed ${data.analyzed}, pre-filtered ${data.preFiltered}, errors ${data.errors}`)
      setSelected(new Set())
      router.refresh()
    } catch {
      setResult('Batch analysis failed')
    } finally {
      setAnalyzing(false)
    }
  }

  const unanalyzedCount = posts.filter(p => !p.signal).length
  const selectedCount = selected.size

  function sortLink(field: string) {
    const currentSort = sortKey
    const currentOrder = sortOrder
    const dir = currentSort === field && currentOrder === 'desc' ? 'asc' : 'desc'
    const qs = new URLSearchParams()
    Object.entries({ ...searchParams, sort: field, order: dir }).forEach(([k, v]) => { if (v) qs.set(k, v) })
    return `/posts?${qs}`
  }

  function pageLink(p: number) {
    const qs = new URLSearchParams()
    Object.entries({ ...searchParams, page: String(p) }).forEach(([k, v]) => { if (v) qs.set(k, v) })
    return `/posts?${qs}`
  }

  function sortArrow(field: string) {
    if (sortKey !== field) return ''
    return sortOrder === 'asc' ? ' ▲' : ' ▼'
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <p className="text-xs text-gray-400">{total} post{total !== 1 ? 's' : ''}</p>
        {unanalyzedCount > 0 && (
          <div className="flex items-center gap-3">
            {result && <span className="text-xs text-gray-500">{result}</span>}
            <button
              onClick={analyzeSelected}
              disabled={analyzing || selectedCount === 0}
              className="px-3 py-1 text-xs bg-gray-900 text-white rounded hover:bg-gray-800 disabled:bg-gray-200 disabled:text-gray-400 disabled:cursor-not-allowed transition-colors"
            >
              {analyzing ? 'Analyzing…' : `Analyze Selected (${selectedCount})`}
            </button>
          </div>
        )}
      </div>

      {posts.length === 0 ? (
        <div className="text-center py-12 text-gray-400">
          <p className="text-sm">No posts match your filters</p>
        </div>
      ) : (
        <div className="bg-white border rounded-lg overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-gray-50 text-xs text-gray-500 uppercase tracking-wide">
                <th className="px-3 py-2.5 text-center w-8">
                  {unanalyzedCount > 0 && (
                    <input
                      type="checkbox"
                      checked={selected.size > 0 && selected.size === unanalyzedCount}
                      onChange={toggleAll}
                      className="accent-gray-900"
                    />
                  )}
                </th>
                <th className="px-3 py-2.5 text-left">
                  <a href={sortLink('postedAt')} className="hover:text-gray-700">Date{sortArrow('postedAt')}</a>
                </th>
                <th className="px-3 py-2.5 text-left">Subreddit</th>
                <th className="px-3 py-2.5 text-left">Title</th>
                <th className="px-3 py-2.5 text-left">Author</th>
                <th className="px-3 py-2.5 text-center">
                  <a href={sortLink('score')} className="hover:text-gray-700">Score{sortArrow('score')}</a>
                </th>
                <th className="px-3 py-2.5 text-center">
                  <a href={sortLink('matchScore')} className="hover:text-gray-700">Match{sortArrow('matchScore')}</a>
                </th>
                <th className="px-3 py-2.5 text-left">Lead</th>
                <th className="px-3 py-2.5 text-center">Action</th>
              </tr>
            </thead>
            <tbody>
              {posts.map(post => (
                <tr key={post.id} className={`border-b last:border-0 hover:bg-gray-50 ${selected.has(post.id) ? 'bg-blue-50' : ''}`}>
                  <td className="px-3 py-2.5 text-center">
                    {!post.signal && (
                      <input
                        type="checkbox"
                        checked={selected.has(post.id)}
                        onChange={() => toggle(post.id)}
                        className="accent-gray-900"
                      />
                    )}
                  </td>
                  <td className="px-3 py-2.5 text-xs text-gray-400 whitespace-nowrap">
                    {new Date(post.postedAt).toLocaleDateString()}
                  </td>
                  <td className="px-3 py-2.5 text-xs text-gray-500 font-mono">
                    r/{post.subreddit}
                  </td>
                  <td className="px-3 py-2.5 max-w-xs">
                    <Link
                      href={`/post/${post.redditId}`}
                      className="text-gray-800 hover:text-blue-600 font-medium truncate block"
                    >
                      {post.title}
                    </Link>
                    {post.signal?.summary && (
                      <p className="text-xs text-gray-400 truncate mt-0.5">{post.signal.summary}</p>
                    )}
                    {post.signal?.technologies && post.signal.technologies.length > 0 && (
                      <div className="flex gap-1 mt-1 flex-wrap">
                        {post.signal.technologies.slice(0, 3).map(t => (
                          <span key={t} className="text-[10px] bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded">
                            {t}
                          </span>
                        ))}
                      </div>
                    )}
                  </td>
                  <td className="px-3 py-2.5 text-xs text-gray-500">
                    {post.author}
                  </td>
                  <td className="px-3 py-2.5 text-center text-xs text-gray-600">
                    {post.score}
                  </td>
                  <td className="px-3 py-2.5 text-center">
                    {post.signal ? (
                      <ScoreBadge score={post.signal.matchScore} />
                    ) : (
                      <span className="text-xs text-gray-300">-</span>
                    )}
                  </td>
                  <td className="px-3 py-2.5">
                    {post.lead ? (
                      <Link href={`/leads/${post.lead.id}`} className="inline-block">
                        <StatusBadge status={post.lead.status} />
                      </Link>
                    ) : (
                      <span className="text-xs text-gray-300">-</span>
                    )}
                  </td>
                  <td className="px-3 py-2.5 text-center">
                    {post.signal ? (
                      <span className="text-[11px] text-gray-300">-</span>
                    ) : (
                      <AnalyzePostButton postId={post.id} variant="table" />
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {totalPages > 1 && (
        <div className="flex justify-center gap-2 mt-4">
          {page > 1 && (
            <a href={pageLink(page - 1)} className="px-3 py-1 text-sm border rounded hover:border-gray-400">
              Previous
            </a>
          )}
          <span className="px-3 py-1 text-sm text-gray-500">
            Page {page} of {totalPages}
          </span>
          {page < totalPages && (
            <a href={pageLink(page + 1)} className="px-3 py-1 text-sm border rounded hover:border-gray-400">
              Next
            </a>
          )}
        </div>
      )}
    </div>
  )
}
