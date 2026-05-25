import { Suspense } from 'react'
import { prisma } from '@/lib/db'
import { Prisma } from '@prisma/client'
import PostsTable from './posts-table'

async function getSubreddits() {
  return prisma.subreddit.findMany({ select: { name: true }, orderBy: { name: 'asc' } })
}

async function getPosts(params: Record<string, string | undefined>) {
  const search = params.search?.trim()
  const subreddit = params.subreddit?.trim()
  const analyzed = params.analyzed
  const lead = params.lead
  const minScore = params.minScore
  const maxScore = params.maxScore
  const sort = params.sort ?? 'postedAt'
  const order = (params.order ?? 'desc') as 'asc' | 'desc'
  const page = Math.max(1, parseInt(params.page ?? '1', 10) || 1)
  const limit = 50

  const where: Prisma.PostWhereInput = {}

  if (search) {
    where.OR = [
      { title: { contains: search, mode: 'insensitive' } },
      { body: { contains: search, mode: 'insensitive' } },
      { author: { contains: search, mode: 'insensitive' } },
    ]
  }

  if (subreddit) {
    where.subreddit = { contains: subreddit, mode: 'insensitive' }
  }

  if (analyzed === 'true') where.signal = { isNot: null }
  else if (analyzed === 'false') where.signal = null

  if (lead === 'true') where.lead = { isNot: null }
  else if (lead === 'false') where.lead = null

  if (minScore || maxScore) {
    const scoreFilter: Record<string, number> = {}
    if (minScore) scoreFilter.gte = parseInt(minScore, 10)
    if (maxScore) scoreFilter.lte = parseInt(maxScore, 10)
    where.signal = { is: { matchScore: scoreFilter } }
  }

  const orderBy: Prisma.PostOrderByWithRelationInput =
    sort === 'score' ? { score: order } :
    sort === 'matchScore' ? { signal: { matchScore: order } } :
    { postedAt: order }

  const [posts, total] = await Promise.all([
    prisma.post.findMany({
      where,
      include: {
        signal: { select: { matchScore: true, technologies: true, seniority: true, summary: true, analyzedAt: true } },
        lead: { select: { id: true, status: true } },
      },
      orderBy,
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.post.count({ where }),
  ])

  return { posts, total, page, limit }
}

export default async function PostsPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | undefined }>
}) {
  const resolvedParams = await searchParams
  const [subreddits, { posts, total, page, limit }] = await Promise.all([
    getSubreddits(),
    getPosts(resolvedParams),
  ])
  const totalPages = Math.ceil(total / limit)

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
        <PostsTable
          posts={posts as any}
          total={total}
          page={page}
          totalPages={totalPages}
          searchParams={resolvedParams}
          sortKey={(resolvedParams.sort ?? 'postedAt') as string}
          sortOrder={(resolvedParams.order ?? 'desc') as 'asc' | 'desc'}
        />
      </Suspense>
    </div>
  )
}
