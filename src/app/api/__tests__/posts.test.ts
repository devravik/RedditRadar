import { GET } from '@/app/api/posts/route'
import { NextRequest } from 'next/server'

jest.mock('@/lib/db', () => ({
  prisma: {
    post: {
      findMany: jest.fn(),
      count: jest.fn(),
    },
  },
}))

import { prisma } from '@/lib/db'

const mockPost = {
  id: 'p1',
  redditId: 'abc123',
  subreddit: 'startups',
  title: 'Need backend engineer',
  body: 'Looking for Laravel help',
  author: 'founder_x',
  url: 'https://reddit.com/r/startups/comments/abc123',
  postedAt: new Date('2025-01-15'),
  score: 10,
  numComments: 3,
  fetchedAt: new Date(),
  signal: null,
  lead: null,
}

describe('GET /api/posts', () => {
  beforeEach(() => jest.clearAllMocks())

  it('returns paginated posts', async () => {
    ;(prisma.post.findMany as jest.Mock).mockResolvedValue([mockPost])
    ;(prisma.post.count as jest.Mock).mockResolvedValue(1)

    const req = new NextRequest('http://localhost/api/posts')
    const res = await GET(req)
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.posts).toHaveLength(1)
    expect(body.total).toBe(1)
    expect(body.page).toBe(1)
    expect(body.limit).toBe(50)
  })

  it('filters by search term', async () => {
    ;(prisma.post.findMany as jest.Mock).mockResolvedValue([])
    ;(prisma.post.count as jest.Mock).mockResolvedValue(0)

    const req = new NextRequest('http://localhost/api/posts?search=laravel')
    await GET(req)

    expect(prisma.post.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          OR: expect.arrayContaining([
            expect.objectContaining({ title: expect.objectContaining({ contains: 'laravel' }) }),
          ]),
        }),
      })
    )
  })

  it('filters by analyzed status', async () => {
    ;(prisma.post.findMany as jest.Mock).mockResolvedValue([])
    ;(prisma.post.count as jest.Mock).mockResolvedValue(0)

    const req = new NextRequest('http://localhost/api/posts?analyzed=true')
    await GET(req)

    expect(prisma.post.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          signal: { isNot: null },
        }),
      })
    )
  })

  it('filters by subreddit', async () => {
    ;(prisma.post.findMany as jest.Mock).mockResolvedValue([])
    ;(prisma.post.count as jest.Mock).mockResolvedValue(0)

    const req = new NextRequest('http://localhost/api/posts?subreddit=startups')
    await GET(req)

    expect(prisma.post.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          subreddit: expect.objectContaining({ contains: 'startups' }),
        }),
      })
    )
  })

  it('supports sort and pagination', async () => {
    ;(prisma.post.findMany as jest.Mock).mockResolvedValue([])
    ;(prisma.post.count as jest.Mock).mockResolvedValue(0)

    const req = new NextRequest('http://localhost/api/posts?sort=score&order=asc&page=2&limit=10')
    await GET(req)

    expect(prisma.post.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        orderBy: { score: 'asc' },
        skip: 10,
        take: 10,
      })
    )
  })
})
