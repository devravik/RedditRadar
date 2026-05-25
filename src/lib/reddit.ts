import { prisma } from '@/lib/db'
import { FetchInterval, RedditPost } from '@/types'
import { shouldSkipPost } from '@/lib/prefilter'

const INTERVAL_MS: Record<FetchInterval, number> = {
  HOURLY: 60 * 60 * 1000,
  DAILY: 24 * 60 * 60 * 1000,
  WEEKLY: 7 * 24 * 60 * 60 * 1000,
}

const PAUSE_MS = 1500

export async function fetchSubredditPosts(subreddit: string, limit = 25): Promise<RedditPost[]> {
  const res = await fetch(
    `https://www.reddit.com/r/${subreddit}/new.json?limit=${limit}`,
    { headers: { 'User-Agent': 'RedditRadar/1.0 (lead-discovery)' } }
  )
  if (!res.ok) throw new Error(`Reddit API error: ${res.status}`)
  const json = await res.json()
  return json.data.children.map((child: { data: RedditPost }) => child.data)
}

export async function fetchDueSubredditPosts(
  blockedWords: string[] = [],
  maxAgeDays = 60
): Promise<{ fetched: number; subreddits: string[]; skipped: number }> {
  const all = await prisma.subreddit.findMany({ where: { enabled: true } })

  const due = all.filter(s =>
    !s.lastFetchedAt ||
    Date.now() - s.lastFetchedAt.getTime() >= INTERVAL_MS[s.fetchInterval]
  )

  const subreddits: string[] = []
  let fetched = 0
  let skipped = 0

  console.log(`[fetch] ${due.length} subreddits due for fetching`)

  for (const sub of due) {
    console.log(`[fetch] Fetching r/${sub.name}…`)
    try {
      const posts = await fetchSubredditPosts(sub.name)
      console.log(`[fetch] r/${sub.name} → ${posts.length} posts`)

      const withinAge = posts.filter(p => Date.now() - p.created_utc * 1000 <= maxAgeDays * 24 * 60 * 60 * 1000)

      const keywordFiltered = withinAge.filter(p => {
        const text = `${p.title} ${p.selftext}`.toLowerCase()
        return !blockedWords.some(w => text.includes(w))
      })

      const filtered = keywordFiltered.filter(p =>
        !shouldSkipPost(p.title, p.selftext, p.score, p.num_comments).skip
      )

      skipped += posts.length - filtered.length

      for (const p of filtered) {
        await prisma.post.upsert({
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
      }

      subreddits.push(sub.name)
      fetched += filtered.length
      console.log(`[fetch] r/${sub.name} → ${filtered.length} upserted, ${posts.length - filtered.length} skipped`)

      await prisma.subreddit.update({
        where: { id: sub.id },
        data: { lastFetchedAt: new Date() },
      })

      if (due.length > 1) {
        await new Promise(resolve => setTimeout(resolve, PAUSE_MS))
      }
    } catch (err) {
      console.error(`Failed to fetch r/${sub.name}:`, err)
    }
  }

  console.log(`[fetch] Done - ${fetched} posts from ${subreddits.join(', ') || '(none)'} (${skipped} skipped)`)
  return { fetched, subreddits, skipped }
}
