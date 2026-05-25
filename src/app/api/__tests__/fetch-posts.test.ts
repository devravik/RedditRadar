import { POST } from '@/app/api/fetch-posts/route'
import { NextRequest } from 'next/server'

jest.mock('@/lib/reddit')
jest.mock('@/lib/db', () => ({
  prisma: {
    post: {
      upsert: jest.fn().mockResolvedValue({ id: 'cuid1' }),
    },
  },
}))

import { fetchAllSubredditPosts } from '@/lib/reddit'
import { prisma } from '@/lib/db'

const mockRedditPost = {
  id: 'abc123',
  subreddit: 'startups',
  title: 'Need backend engineer',
  selftext: 'Looking for Laravel help',
  author: 'founder_x',
  url: 'https://reddit.com/r/startups/comments/abc123',
  created_utc: 1716825600,
  score: 10,
  num_comments: 3,
}

describe('POST /api/fetch-posts', () => {
  beforeEach(() => jest.clearAllMocks())

  it('returns 200 with count of upserted posts', async () => {
    ;(fetchAllSubredditPosts as jest.Mock).mockResolvedValue([mockRedditPost])

    const req = new NextRequest('http://localhost/api/fetch-posts', { method: 'POST' })
    const res = await POST(req)
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.fetched).toBe(1)
  })

  it('calls prisma.post.upsert with correct shape', async () => {
    ;(fetchAllSubredditPosts as jest.Mock).mockResolvedValue([mockRedditPost])

    const req = new NextRequest('http://localhost/api/fetch-posts', { method: 'POST' })
    await POST(req)

    expect(prisma.post.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { redditId: 'abc123' },
        create: expect.objectContaining({
          redditId: 'abc123',
          subreddit: 'startups',
          title: 'Need backend engineer',
        }),
      })
    )
  })

  it('returns 500 when Reddit fetch fails', async () => {
    ;(fetchAllSubredditPosts as jest.Mock).mockRejectedValue(new Error('network error'))

    const req = new NextRequest('http://localhost/api/fetch-posts', { method: 'POST' })
    const res = await POST(req)

    expect(res.status).toBe(500)
  })
})
