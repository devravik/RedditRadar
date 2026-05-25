import { Suspense } from 'react'
import { prisma } from '@/lib/db'
import PostsTable from './posts-table'

async function getSubreddits() {
  return prisma.subreddit.findMany({ select: { name: true }, orderBy: { name: 'asc' } })
}

export default async function PostsPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | undefined }>
}) {
  const resolvedParams = await searchParams
  const subreddits = await getSubreddits()

  const qs = new URLSearchParams()
  Object.entries(resolvedParams).forEach(([k, v]) => { if (v) qs.set(k, v) })

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Posts</h1>
        <p className="text-sm text-gray-500 mt-0.5">Browse, search, and inspect imported posts and their analysis</p>
      </div>

      <div className="bg-white border rounded-lg p-4 mb-6">
        <form method="GET" className="flex flex-wrap gap-3 items-end">
          <div>
            <label className="block text-xs text-gray-500 mb-1">Search</label>
            <input
              name="search"
              defaultValue={resolvedParams.search ?? ''}
              placeholder="title, body, author…"
              className="text-sm border rounded px-2.5 py-1.5 w-56 focus:outline-none focus:ring-1 focus:ring-gray-400"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Subreddit</label>
            <select
              name="subreddit"
              defaultValue={resolvedParams.subreddit ?? ''}
              className="text-sm border rounded px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-gray-400"
            >
              <option value="">All</option>
              {subreddits.map(s => (
                <option key={s.name} value={s.name}>r/{s.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Analysis</label>
            <select
              name="analyzed"
              defaultValue={resolvedParams.analyzed ?? ''}
              className="text-sm border rounded px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-gray-400"
            >
              <option value="">All</option>
              <option value="true">Analyzed</option>
              <option value="false">Not analyzed</option>
            </select>
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Lead</label>
            <select
              name="lead"
              defaultValue={resolvedParams.lead ?? ''}
              className="text-sm border rounded px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-gray-400"
            >
              <option value="">All</option>
              <option value="true">Has lead</option>
              <option value="false">No lead</option>
            </select>
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Min score</label>
            <input
              name="minScore"
              type="number"
              min="0"
              max="100"
              defaultValue={resolvedParams.minScore ?? ''}
              placeholder="0"
              className="text-sm border rounded px-2.5 py-1.5 w-16 focus:outline-none focus:ring-1 focus:ring-gray-400"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Max score</label>
            <input
              name="maxScore"
              type="number"
              min="0"
              max="100"
              defaultValue={resolvedParams.maxScore ?? ''}
              placeholder="100"
              className="text-sm border rounded px-2.5 py-1.5 w-16 focus:outline-none focus:ring-1 focus:ring-gray-400"
            />
          </div>
          <div className="flex gap-2">
            <button
              type="submit"
              className="px-3 py-1.5 text-sm bg-gray-900 text-white rounded hover:bg-gray-800 transition-colors"
            >
              Search
            </button>
            <a
              href="/posts"
              className="px-3 py-1.5 text-sm border rounded text-gray-600 hover:border-gray-400 transition-colors"
            >
              Clear
            </a>
          </div>
        </form>
      </div>

      <Suspense fallback={<div className="text-center py-8 text-sm text-gray-400">Loading posts…</div>}>
        <PostsTable searchParams={resolvedParams} />
      </Suspense>
    </div>
  )
}
