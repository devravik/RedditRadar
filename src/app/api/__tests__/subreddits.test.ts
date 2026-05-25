import { GET, POST } from '@/app/api/subreddits/route'
import { NextRequest } from 'next/server'

jest.mock('@/lib/db', () => ({
  prisma: {
    subreddit: {
      findMany: jest.fn(),
      create: jest.fn(),
    },
  },
}))

import { prisma } from '@/lib/db'

const mockSub = {
  id: 'sub1',
  name: 'startups',
  enabled: true,
  fetchInterval: 'DAILY',
  lastFetchedAt: null,
  createdAt: new Date(),
}

describe('GET /api/subreddits', () => {
  it('returns all subreddits ordered by name', async () => {
    ;(prisma.subreddit.findMany as jest.Mock).mockResolvedValue([mockSub])

    const req = new NextRequest('http://localhost/api/subreddits')
    const res = await GET(req)
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body).toHaveLength(1)
    expect(body[0].name).toBe('startups')
    expect(prisma.subreddit.findMany).toHaveBeenCalledWith({ orderBy: { name: 'asc' } })
  })
})

describe('POST /api/subreddits', () => {
  beforeEach(() => jest.clearAllMocks())

  it('creates a subreddit and normalizes name (strips r/, lowercases)', async () => {
    ;(prisma.subreddit.create as jest.Mock).mockResolvedValue(mockSub)

    const req = new NextRequest('http://localhost/api/subreddits', {
      method: 'POST',
      body: JSON.stringify({ name: 'r/Startups', fetchInterval: 'DAILY' }),
      headers: { 'Content-Type': 'application/json' },
    })
    const res = await POST(req)

    expect(res.status).toBe(201)
    expect(prisma.subreddit.create).toHaveBeenCalledWith({
      data: { name: 'startups', fetchInterval: 'DAILY', enabled: true },
    })
  })

  it('defaults fetchInterval to DAILY when not provided', async () => {
    ;(prisma.subreddit.create as jest.Mock).mockResolvedValue(mockSub)

    const req = new NextRequest('http://localhost/api/subreddits', {
      method: 'POST',
      body: JSON.stringify({ name: 'golang' }),
      headers: { 'Content-Type': 'application/json' },
    })
    await POST(req)

    expect(prisma.subreddit.create).toHaveBeenCalledWith({
      data: { name: 'golang', fetchInterval: 'DAILY', enabled: true },
    })
  })

  it('returns 400 for invalid name (spaces, special chars)', async () => {
    const req = new NextRequest('http://localhost/api/subreddits', {
      method: 'POST',
      body: JSON.stringify({ name: 'invalid name!' }),
      headers: { 'Content-Type': 'application/json' },
    })
    const res = await POST(req)
    expect(res.status).toBe(400)
  })

  it('returns 400 when name is missing', async () => {
    const req = new NextRequest('http://localhost/api/subreddits', {
      method: 'POST',
      body: JSON.stringify({ fetchInterval: 'DAILY' }),
      headers: { 'Content-Type': 'application/json' },
    })
    const res = await POST(req)
    expect(res.status).toBe(400)
  })

  it('returns 400 for invalid fetchInterval', async () => {
    const req = new NextRequest('http://localhost/api/subreddits', {
      method: 'POST',
      body: JSON.stringify({ name: 'golang', fetchInterval: 'MONTHLY' }),
      headers: { 'Content-Type': 'application/json' },
    })
    const res = await POST(req)
    expect(res.status).toBe(400)
  })

  it('returns 409 when subreddit already exists', async () => {
    ;(prisma.subreddit.create as jest.Mock).mockRejectedValue({ code: 'P2002' })

    const req = new NextRequest('http://localhost/api/subreddits', {
      method: 'POST',
      body: JSON.stringify({ name: 'startups' }),
      headers: { 'Content-Type': 'application/json' },
    })
    const res = await POST(req)
    expect(res.status).toBe(409)
  })
})
