import { fetchSubredditPosts, fetchDueSubredditPosts } from '@/lib/reddit'
import { RedditPost } from '@/types'

jest.mock('@/lib/db', () => ({
  prisma: {
    subreddit: {
      findMany: jest.fn(),
      update: jest.fn().mockResolvedValue({}),
    },
  },
}))

import { prisma } from '@/lib/db'

const mockPost = (id: string, subreddit: string): RedditPost => ({
  id,
  subreddit,
  title: `Test post in ${subreddit}`,
  selftext: 'We need backend help',
  author: 'founder_bob',
  url: `https://reddit.com/r/${subreddit}/comments/${id}`,
  created_utc: 1716825600,
  score: 5,
  num_comments: 2,
})

function makeRedditResponse(posts: RedditPost[]) {
  return { data: { children: posts.map(p => ({ data: p })) } }
}

describe('fetchSubredditPosts', () => {
  beforeEach(() => jest.resetAllMocks())

  it('returns parsed posts for a subreddit', async () => {
    const posts = [mockPost('abc', 'startups'), mockPost('def', 'startups')]
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => makeRedditResponse(posts),
    } as Response)

    const result = await fetchSubredditPosts('startups')

    expect(global.fetch).toHaveBeenCalledWith(
      'https://www.reddit.com/r/startups/new.json?limit=25',
      expect.objectContaining({ headers: expect.any(Object) })
    )
    expect(result).toHaveLength(2)
    expect(result[0].id).toBe('abc')
  })

  it('throws when Reddit returns non-OK status', async () => {
    global.fetch = jest.fn().mockResolvedValue({ ok: false, status: 429 } as Response)
    await expect(fetchSubredditPosts('startups')).rejects.toThrow('Reddit API error: 429')
  })
})

describe('fetchDueSubredditPosts', () => {
  beforeEach(() => jest.clearAllMocks())

  it('returns empty when no enabled subreddits in DB', async () => {
    ;(prisma.subreddit.findMany as jest.Mock).mockResolvedValue([])
    global.fetch = jest.fn()

    const result = await fetchDueSubredditPosts()

    expect(result.posts).toHaveLength(0)
    expect(result.subreddits).toHaveLength(0)
    expect(global.fetch).not.toHaveBeenCalled()
  })

  it('fetches subreddit with null lastFetchedAt (never fetched)', async () => {
    ;(prisma.subreddit.findMany as jest.Mock).mockResolvedValue([
      { id: 's1', name: 'startups', fetchInterval: 'DAILY', lastFetchedAt: null },
    ])
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => makeRedditResponse([mockPost('a', 'startups')]),
    } as Response)

    const result = await fetchDueSubredditPosts()

    expect(result.subreddits).toEqual(['startups'])
    expect(result.posts).toHaveLength(1)
  })

  it('skips subreddit fetched within DAILY interval (not yet due)', async () => {
    const recentDate = new Date(Date.now() - 60 * 60 * 1000) // 1 hour ago
    ;(prisma.subreddit.findMany as jest.Mock).mockResolvedValue([
      { id: 's1', name: 'startups', fetchInterval: 'DAILY', lastFetchedAt: recentDate },
    ])
    global.fetch = jest.fn()

    const result = await fetchDueSubredditPosts()

    expect(result.subreddits).toHaveLength(0)
    expect(global.fetch).not.toHaveBeenCalled()
  })

  it('fetches subreddit past HOURLY interval (overdue)', async () => {
    const oldDate = new Date(Date.now() - 2 * 60 * 60 * 1000) // 2 hours ago
    ;(prisma.subreddit.findMany as jest.Mock).mockResolvedValue([
      { id: 's1', name: 'laravel', fetchInterval: 'HOURLY', lastFetchedAt: oldDate },
    ])
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => makeRedditResponse([mockPost('b', 'laravel')]),
    } as Response)

    const result = await fetchDueSubredditPosts()

    expect(result.subreddits).toContain('laravel')
    expect(result.posts).toHaveLength(1)
  })

  it('updates lastFetchedAt after successful fetch', async () => {
    ;(prisma.subreddit.findMany as jest.Mock).mockResolvedValue([
      { id: 's1', name: 'golang', fetchInterval: 'DAILY', lastFetchedAt: null },
    ])
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => makeRedditResponse([]),
    } as Response)

    await fetchDueSubredditPosts()

    expect(prisma.subreddit.update).toHaveBeenCalledWith({
      where: { id: 's1' },
      data: { lastFetchedAt: expect.any(Date) },
    })
  })

  it('skips subreddit on fetch error and does not update lastFetchedAt', async () => {
    ;(prisma.subreddit.findMany as jest.Mock).mockResolvedValue([
      { id: 's1', name: 'forhire', fetchInterval: 'DAILY', lastFetchedAt: null },
    ])
    global.fetch = jest.fn().mockResolvedValue({ ok: false, status: 503 } as Response)

    const result = await fetchDueSubredditPosts()

    expect(result.subreddits).toHaveLength(0)
    expect(prisma.subreddit.update).not.toHaveBeenCalled()
  })
})
