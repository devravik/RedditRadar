import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

const VALID_INTERVALS = ['HOURLY', 'DAILY', 'WEEKLY'] as const

function normalizeName(raw: string): string {
  return raw.trim().replace(/^r\//i, '').toLowerCase()
}

export async function GET(_req: NextRequest) {
  const subreddits = await prisma.subreddit.findMany({ orderBy: { name: 'asc' } })
  return NextResponse.json(subreddits)
}

export async function POST(req: NextRequest) {
  const body = await req.json()

  if (!body.name?.trim()) {
    return NextResponse.json({ error: 'name is required' }, { status: 400 })
  }

  const name = normalizeName(body.name)
  if (!/^[a-z0-9_]+$/.test(name)) {
    return NextResponse.json({ error: 'Invalid subreddit name — alphanumeric and underscores only' }, { status: 400 })
  }

  const fetchInterval = body.fetchInterval ?? 'DAILY'
  if (!VALID_INTERVALS.includes(fetchInterval)) {
    return NextResponse.json({ error: 'fetchInterval must be HOURLY, DAILY, or WEEKLY' }, { status: 400 })
  }

  try {
    const subreddit = await prisma.subreddit.create({
      data: { name, fetchInterval, enabled: true },
    })
    return NextResponse.json(subreddit, { status: 201 })
  } catch (err: unknown) {
    if ((err as { code?: string }).code === 'P2002') {
      return NextResponse.json({ error: 'Subreddit already exists' }, { status: 409 })
    }
    console.error('POST /api/subreddits error:', err)
    return NextResponse.json({ error: 'Failed to create subreddit' }, { status: 500 })
  }
}
