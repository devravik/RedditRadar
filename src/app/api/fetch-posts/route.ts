import { NextRequest, NextResponse } from 'next/server'
import { fetchAllSubredditPosts } from '@/lib/reddit'
import { prisma } from '@/lib/db'

export async function POST(_req: NextRequest) {
  try {
    const posts = await fetchAllSubredditPosts()

    await Promise.all(
      posts.map(p =>
        prisma.post.upsert({
          where: { redditId: p.id },
          create: {
            redditId: p.id,
            subreddit: p.subreddit,
            title: p.title,
            body: p.selftext,
            author: p.author,
            url: p.url,
            postedAt: new Date(p.created_utc * 1000),
            score: p.score,
            numComments: p.num_comments,
          },
          update: {
            score: p.score,
            numComments: p.num_comments,
          },
        })
      )
    )

    return NextResponse.json({ fetched: posts.length })
  } catch (err) {
    console.error('fetch-posts error:', err)
    return NextResponse.json({ error: 'Failed to fetch posts' }, { status: 500 })
  }
}
