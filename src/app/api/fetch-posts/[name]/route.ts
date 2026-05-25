import { NextResponse } from 'next/server'
import { fetchSubredditPosts } from '@/lib/reddit'
import { prisma } from '@/lib/db'
import { shouldSkipPost } from '@/lib/prefilter'

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ name: string }> }
) {
  try {
    const { name } = await params

    const subreddit = await prisma.subreddit.findUnique({ where: { name } })
    if (!subreddit) {
      return NextResponse.json({ error: 'Subreddit not found' }, { status: 404 })
    }

    const [blocked, maxAgeSetting] = await Promise.all([
      prisma.blockedKeyword.findMany({ select: { word: true } }),
      prisma.setting.findUnique({ where: { key: 'FETCH_MAX_AGE_DAYS' } }),
    ])
    const blockedWords = blocked.map(b => b.word.toLowerCase())
    const maxAgeDays = parseInt(maxAgeSetting?.value ?? '60', 10)
    const cutoff = Date.now() - maxAgeDays * 24 * 60 * 60 * 1000

    const posts = await fetchSubredditPosts(name)

    let upserted = 0
    let skipped = 0
    for (const post of posts) {
      if (post.created_utc * 1000 < cutoff) { skipped++; continue }

      const body = (post.selftext || '').slice(0, 5000)

      const titleBody = `${post.title} ${body}`.toLowerCase()
      if (blockedWords.some(w => titleBody.includes(w))) { skipped++; continue }

      if (shouldSkipPost(post.title, body, post.score, post.num_comments).skip) { skipped++; continue }

      await prisma.post.upsert({
        where: { redditId: post.id },
        update: { score: post.score, numComments: post.num_comments },
        create: {
          redditId: post.id,
          subreddit: name,
          title: post.title,
          body,
          author: post.author,
          url: post.url,
          postedAt: new Date(post.created_utc * 1000),
          score: post.score,
          numComments: post.num_comments,
        },
      })
      upserted++
    }

    await prisma.subreddit.update({
      where: { id: subreddit.id },
      data: { lastFetchedAt: new Date() },
    })

    console.log(`[fetch] r/${name} → ${upserted} upserted, ${skipped} skipped`)
    return NextResponse.json({ subreddit: name, fetched: upserted, skipped })
  } catch (err) {
    console.error(`fetch-posts/[name] error:`, err)
    return NextResponse.json({ error: 'Failed to fetch subreddit' }, { status: 500 })
  }
}
