import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

export async function GET(_req: NextRequest) {
  const subreddits = await prisma.subreddit.findMany({ orderBy: { name: 'asc' } })

  const rows = subreddits.map(s => `${s.name},${s.enabled},${s.fetchInterval}`)
  const csv = ['name,enabled,fetchInterval', ...rows].join('\n')

  return new NextResponse(csv, {
    headers: {
      'Content-Type': 'text/csv',
      'Content-Disposition': 'attachment; filename="subreddits.csv"',
    },
  })
}
