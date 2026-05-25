import { fetchSubredditPosts, fetchDueSubredditPosts } from '@/lib/reddit'
import { RedditPost } from '@/types'

jest.mock('@/lib/db', () => ({
  prisma: {
    subreddit: {
      findMany: jest.fn(),
      update: jest.fn().mockResolvedValue({}),
    },
    post: {
      upsert: jest.fn().mockResolvedValue({ id: 'cuid1' }),
    },
  },
}))

import { prisma } from '@/lib/db'

const NOW = Math.floor(Date.now() / 1000)

const mockPost = (id: string, subreddit: string): RedditPost => ({
  id,
  subreddit,
  title: `Test post in ${subreddit}`,
  selftext: 'We need backend help',
  author: 'founder_bob',
  url: `https://reddit.com/r/${subreddit}/comments/${id}`,
  created_utc: NOW - 3600,
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

    expect(result.fetched).toBe(0)
    expect(result.subreddits).toHaveLength(0)
    expect(result.skipped).toBe(0)
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
    expect(result.fetched).toBe(1)
    expect(prisma.post.upsert).toHaveBeenCalled()
  })

  it('skips subreddit fetched within DAILY interval (not yet due)', async () => {
    const recentDate = new Date(Date.now() - 60 * 60 * 1000)
    ;(prisma.subreddit.findMany as jest.Mock).mockResolvedValue([
      { id: 's1', name: 'startups', fetchInterval: 'DAILY', lastFetchedAt: recentDate },
    ])
    global.fetch = jest.fn()

    const result = await fetchDueSubredditPosts()

    expect(result.subreddits).toHaveLength(0)
    expect(global.fetch).not.toHaveBeenCalled()
  })

  it('fetches subreddit past HOURLY interval (overdue)', async () => {
    const oldDate = new Date(Date.now() - 2 * 60 * 60 * 1000)
    ;(prisma.subreddit.findMany as jest.Mock).mockResolvedValue([
      { id: 's1', name: 'laravel', fetchInterval: 'HOURLY', lastFetchedAt: oldDate },
    ])
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => makeRedditResponse([mockPost('b', 'laravel')]),
    } as Response)

    const result = await fetchDueSubredditPosts()

    expect(result.subreddits).toContain('laravel')
    expect(result.fetched).toBe(1)
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

  it('filters out posts containing blocked words', async () => {
    ;(prisma.subreddit.findMany as jest.Mock).mockResolvedValue([
      { id: 's1', name: 'startups', fetchInterval: 'DAILY', lastFetchedAt: null },
    ])
    const postWithHire = mockPost('a', 'startups')
    postWithHire.title = 'Looking for hire backend dev'
    const postClean = mockPost('b', 'startups')
    postClean.title = 'Need help with scaling'
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => makeRedditResponse([postWithHire, postClean]),
    } as Response)

    const result = await fetchDueSubredditPosts(['for hire'])

    expect(result.fetched).toBe(1)
    expect(result.skipped).toBe(1)
  })

  it('filters out posts older than 2 months', async () => {
    ;(prisma.subreddit.findMany as jest.Mock).mockResolvedValue([
      { id: 's1', name: 'startups', fetchInterval: 'DAILY', lastFetchedAt: null },
    ])
    const oldPost = mockPost('a', 'startups')
    oldPost.created_utc = NOW - 100 * 24 * 3600
    const recentPost = mockPost('b', 'startups')
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => makeRedditResponse([oldPost, recentPost]),
    } as Response)

    const result = await fetchDueSubredditPosts()

    expect(result.fetched).toBe(1)
    expect(result.skipped).toBe(1)
  })
})
