import { RedditPost } from '@/types'

export const SUBREDDITS = [
  'forhire',
  'hiring',
  'startups',
  'SaaS',
  'webdev',
  'laravel',
  'golang',
  'remotework',
] as const

export async function fetchSubredditPosts(subreddit: string, limit = 25): Promise<RedditPost[]> {
  const res = await fetch(
    `https://www.reddit.com/r/${subreddit}/new.json?limit=${limit}`,
    { headers: { 'User-Agent': 'RedditRadar/1.0 (lead-discovery)' } }
  )

  if (!res.ok) throw new Error(`Reddit API error: ${res.status}`)

  const json = await res.json()
  return json.data.children.map((child: { data: RedditPost }) => child.data)
}

export async function fetchAllSubredditPosts(): Promise<RedditPost[]> {
  const results = await Promise.allSettled(
    SUBREDDITS.map(sub => fetchSubredditPosts(sub))
  )

  return results
    .filter((r): r is PromiseFulfilledResult<RedditPost[]> => r.status === 'fulfilled')
    .flatMap(r => r.value)
}
