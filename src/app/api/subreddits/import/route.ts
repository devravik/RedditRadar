import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

const VALID_INTERVALS = ['HOURLY', 'DAILY', 'WEEKLY']

export async function POST(req: NextRequest) {
  try {
    const csv = await req.text()
    const lines = csv.trim().split('\n').map(l => l.trim()).filter(Boolean)

    // Skip header row if present
    const dataLines = lines[0]?.startsWith('name') ? lines.slice(1) : lines

    let added = 0
    let skipped = 0

    for (const line of dataLines) {
      const parts = line.split(',')
      const rawName = parts[0]?.trim()
      if (!rawName) { skipped++; continue }

      const name = rawName.replace(/^r\//i, '').toLowerCase()
      if (!/^[a-z0-9_]+$/.test(name)) { skipped++; continue }

      const fetchInterval = VALID_INTERVALS.includes(parts[2]?.trim())
        ? parts[2].trim()
        : 'DAILY'

      try {
        await prisma.subreddit.create({ data: { name, fetchInterval, enabled: true } })
        added++
      } catch (err: unknown) {
        if ((err as { code?: string }).code === 'P2002') { skipped++; continue }
        throw err
      }
    }

    return NextResponse.json({ added, skipped })
  } catch (err) {
    console.error('POST /api/subreddits/import error:', err)
    return NextResponse.json({ error: 'Failed to import CSV' }, { status: 500 })
  }
}
