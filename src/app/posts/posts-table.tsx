import { prisma } from '@/lib/db'
import { Prisma } from '@prisma/client'
import Link from 'next/link'
import { ScoreBadge } from '@/components/score-badge'
import { StatusBadge } from '@/components/status-badge'

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

export default async function PostsTable({
  searchParams,
}: {
  searchParams: Record<string, string | undefined>
}) {
  const { posts, total, page, limit } = await getPosts(searchParams)
  const totalPages = Math.ceil(total / limit)

  function sortLink(field: string) {
    const currentSort = searchParams.sort ?? 'postedAt'
    const currentOrder = searchParams.order ?? 'desc'
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
    if ((searchParams.sort ?? 'postedAt') !== field) return ''
    return searchParams.order === 'asc' ? ' ▲' : ' ▼'
  }

  return (
    <div>
      <p className="text-xs text-gray-400 mb-3">{total} post{total !== 1 ? 's' : ''}</p>

      {posts.length === 0 ? (
        <div className="text-center py-12 text-gray-400">
          <p className="text-sm">No posts match your filters</p>
        </div>
      ) : (
        <div className="bg-white border rounded-lg overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-gray-50 text-xs text-gray-500 uppercase tracking-wide">
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
              </tr>
            </thead>
            <tbody>
              {posts.map(post => (
                <tr key={post.id} className="border-b last:border-0 hover:bg-gray-50">
                  <td className="px-3 py-2.5 text-xs text-gray-400 whitespace-nowrap">
                    {new Date(post.postedAt).toLocaleDateString()}
                  </td>
                  <td className="px-3 py-2.5 text-xs text-gray-500 font-mono">
                    r/{post.subreddit}
                  </td>
                  <td className="px-3 py-2.5 max-w-xs">
                    <a
                      href={post.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-gray-800 hover:text-blue-600 font-medium truncate block"
                    >
                      {post.title}
                    </a>
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
                      <span className="text-xs text-gray-300">—</span>
                    )}
                  </td>
                  <td className="px-3 py-2.5">
                    {post.lead ? (
                      <Link href={`/leads/${post.lead.id}`} className="inline-block">
                        <StatusBadge status={post.lead.status} />
                      </Link>
                    ) : (
                      <span className="text-xs text-gray-300">—</span>
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
