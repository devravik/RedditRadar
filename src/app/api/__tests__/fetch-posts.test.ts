import { POST } from '@/app/api/fetch-posts/route'
import { NextRequest } from 'next/server'

jest.mock('@/lib/reddit')
jest.mock('@/lib/db', () => ({
  prisma: {
    blockedKeyword: {
      findMany: jest.fn().mockResolvedValue([]),
    },
    setting: {
      findUnique: jest.fn().mockResolvedValue({ key: 'FETCH_MAX_AGE_DAYS', value: '60' }),
    },
  },
}))

import { fetchDueSubredditPosts } from '@/lib/reddit'

describe('POST /api/fetch-posts', () => {
  beforeEach(() => jest.clearAllMocks())

  it('returns 200 with count and subreddit names', async () => {
    ;(fetchDueSubredditPosts as jest.Mock).mockResolvedValue({
      fetched: 3,
      subreddits: ['startups', 'golang'],
      skipped: 1,
    })

    const req = new NextRequest('http://localhost/api/fetch-posts', { method: 'POST' })
    const res = await POST(req)
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.fetched).toBe(3)
    expect(body.subreddits).toEqual(['startups', 'golang'])
    expect(body.skipped).toBe(1)
  })

  it('passes blocked keywords to fetchDueSubredditPosts', async () => {
    const { prisma } = jest.requireMock('@/lib/db')
    prisma.blockedKeyword.findMany.mockResolvedValue([
      { id: 'k1', word: '[For Hire]' },
    ])
    ;(fetchDueSubredditPosts as jest.Mock).mockResolvedValue({
      fetched: 0, subreddits: [], skipped: 0,
    })

    const req = new NextRequest('http://localhost/api/fetch-posts', { method: 'POST' })
    await POST(req)

    expect(fetchDueSubredditPosts).toHaveBeenCalledWith(['[for hire]'], 60)
  })

  it('returns 500 when fetch fails', async () => {
    ;(fetchDueSubredditPosts as jest.Mock).mockRejectedValue(new Error('db error'))

    const req = new NextRequest('http://localhost/api/fetch-posts', { method: 'POST' })
    const res = await POST(req)

    expect(res.status).toBe(500)
  })
})
