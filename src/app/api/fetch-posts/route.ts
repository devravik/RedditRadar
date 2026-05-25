import { NextRequest, NextResponse } from 'next/server'
import { fetchDueSubredditPosts } from '@/lib/reddit'
import { prisma } from '@/lib/db'

export async function POST(_req: NextRequest) {
  try {
    const [blocked, maxAgeSetting] = await Promise.all([
      prisma.blockedKeyword.findMany({ select: { word: true } }),
      prisma.setting.findUnique({ where: { key: 'FETCH_MAX_AGE_DAYS' } }),
    ])
    const blockedWords = blocked.map(b => b.word.toLowerCase())
    const maxAgeDays = parseInt(maxAgeSetting?.value ?? '60', 10)

    const result = await fetchDueSubredditPosts(blockedWords, maxAgeDays)
    return NextResponse.json(result)
  } catch (err) {
    console.error('fetch-posts error:', err)
    return NextResponse.json({ error: 'Failed to fetch posts' }, { status: 500 })
  }
}
