import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)

  const search = searchParams.get('search')?.trim()
  const subreddit = searchParams.get('subreddit')?.trim()
  const analyzed = searchParams.get('analyzed')
  const lead = searchParams.get('lead')
  const minScore = searchParams.get('minScore')
  const maxScore = searchParams.get('maxScore')
  const sort = searchParams.get('sort') ?? 'postedAt'
  const order = (searchParams.get('order') ?? 'desc') as 'asc' | 'desc'
  const page = Math.max(1, parseInt(searchParams.get('page') ?? '1', 10) || 1)
  const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') ?? '50', 10) || 50))

  const where: Record<string, unknown> = {}

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

  const orderBy: Record<string, unknown> =
    sort === 'score' ? { score: order } :
    sort === 'matchScore' ? { signal: { matchScore: order } } :
    { postedAt: order }

  const [posts, total] = await Promise.all([
    prisma.post.findMany({
      where,
      include: {
        signal: { select: { matchScore: true, technologies: true, painPoints: true, seniority: true, remote: true, startupStage: true, summary: true, analyzedAt: true } },
        lead: { select: { id: true, status: true } },
      },
      orderBy,
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.post.count({ where }),
  ])

  return NextResponse.json({ posts, total, page, limit })
}
