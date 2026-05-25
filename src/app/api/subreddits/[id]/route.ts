import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

const VALID_INTERVALS = ['HOURLY', 'DAILY', 'WEEKLY']

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await req.json()

    const data: Record<string, unknown> = {}
    if (body.enabled !== undefined) data.enabled = Boolean(body.enabled)
    if (body.fetchInterval !== undefined) {
      if (!VALID_INTERVALS.includes(body.fetchInterval)) {
        return NextResponse.json({ error: 'fetchInterval must be HOURLY, DAILY, or WEEKLY' }, { status: 400 })
      }
      data.fetchInterval = body.fetchInterval
    }

    const subreddit = await prisma.subreddit.update({ where: { id }, data })
    return NextResponse.json(subreddit)
  } catch (err: unknown) {
    if ((err as { code?: string }).code === 'P2025') {
      return NextResponse.json({ error: 'Subreddit not found' }, { status: 404 })
    }
    console.error('PATCH /api/subreddits/[id] error:', err)
    return NextResponse.json({ error: 'Failed to update subreddit' }, { status: 500 })
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    await prisma.subreddit.delete({ where: { id } })
    return NextResponse.json({ ok: true })
  } catch (err: unknown) {
    if ((err as { code?: string }).code === 'P2025') {
      return NextResponse.json({ error: 'Subreddit not found' }, { status: 404 })
    }
    console.error('DELETE /api/subreddits/[id] error:', err)
    return NextResponse.json({ error: 'Failed to delete subreddit' }, { status: 500 })
  }
}
