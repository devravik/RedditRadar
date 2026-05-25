import { prisma } from '@/lib/db'
import { FetchInterval, RedditPost } from '@/types'

const INTERVAL_MS: Record<FetchInterval, number> = {
  HOURLY: 60 * 60 * 1000,
  DAILY: 24 * 60 * 60 * 1000,
  WEEKLY: 7 * 24 * 60 * 60 * 1000,
}

export async function fetchSubredditPosts(subreddit: string, limit = 25): Promise<RedditPost[]> {
  const res = await fetch(
    `https://www.reddit.com/r/${subreddit}/new.json?limit=${limit}`,
    { headers: { 'User-Agent': 'RedditRadar/1.0 (lead-discovery)' } }
  )
  if (!res.ok) throw new Error(`Reddit API error: ${res.status}`)
  const json = await res.json()
  return json.data.children.map((child: { data: RedditPost }) => child.data)
}

export async function fetchDueSubredditPosts(): Promise<{ posts: RedditPost[]; subreddits: string[] }> {
  const all = await prisma.subreddit.findMany({ where: { enabled: true } })

  const due = all.filter(s =>
    !s.lastFetchedAt ||
    Date.now() - s.lastFetchedAt.getTime() >= INTERVAL_MS[s.fetchInterval]
  )

  const posts: RedditPost[] = []
  const subreddits: string[] = []

  for (const sub of due) {
    try {
      const fetched = await fetchSubredditPosts(sub.name)
      posts.push(...fetched)
      subreddits.push(sub.name)
      await prisma.subreddit.update({
        where: { id: sub.id },
        data: { lastFetchedAt: new Date() },
      })
    } catch (err) {
      console.error(`Failed to fetch r/${sub.name}:`, err)
    }
  }

  return { posts, subreddits }
}
