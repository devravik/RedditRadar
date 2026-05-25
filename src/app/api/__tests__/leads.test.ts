import { GET, POST } from '@/app/api/leads/route'
import { GET as GET_DETAIL, PATCH } from '@/app/api/leads/[id]/route'
import { NextRequest } from 'next/server'

jest.mock('@/lib/db', () => ({
  prisma: {
    lead: {
      findMany: jest.fn(),
      create: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
    },
  },
}))

import { prisma } from '@/lib/db'

const mockLead = {
  id: 'lead1',
  postId: 'post1',
  status: 'NEW',
  notes: null,
  contactedAt: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  post: { title: 'Backend help needed', subreddit: 'startups', url: 'http://reddit.com/...', author: 'founder_x' },
  signal: { matchScore: 80, technologies: ['Laravel'], painPoints: ['queues'], summary: 'Good match.' },
  messages: [],
}

describe('GET /api/leads', () => {
  it('returns leads list', async () => {
    ;(prisma.lead.findMany as jest.Mock).mockResolvedValue([mockLead])

    const req = new NextRequest('http://localhost/api/leads')
    const res = await GET(req)
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body).toHaveLength(1)
    expect(body[0].id).toBe('lead1')
  })
})

describe('POST /api/leads', () => {
  it('creates a lead for a post', async () => {
    ;(prisma.lead.create as jest.Mock).mockResolvedValue(mockLead)

    const req = new NextRequest('http://localhost/api/leads', {
      method: 'POST',
      body: JSON.stringify({ postId: 'post1' }),
      headers: { 'Content-Type': 'application/json' },
    })
    const res = await POST(req)

    expect(res.status).toBe(201)
    expect(prisma.lead.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: { postId: 'post1' } })
    )
  })

  it('returns 400 when postId is missing', async () => {
    const req = new NextRequest('http://localhost/api/leads', {
      method: 'POST',
      body: JSON.stringify({}),
      headers: { 'Content-Type': 'application/json' },
    })
    const res = await POST(req)

    expect(res.status).toBe(400)
  })
})

describe('PATCH /api/leads/[id]', () => {
  it('updates lead status and notes', async () => {
    ;(prisma.lead.update as jest.Mock).mockResolvedValue({ ...mockLead, status: 'CONTACTED' })

    const req = new NextRequest('http://localhost/api/leads/lead1', {
      method: 'PATCH',
      body: JSON.stringify({ status: 'CONTACTED', notes: 'Sent DM' }),
      headers: { 'Content-Type': 'application/json' },
    })
    const res = await PATCH(req, { params: { id: 'lead1' } })
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(prisma.lead.update).toHaveBeenCalledWith({
      where: { id: 'lead1' },
      data: expect.objectContaining({ status: 'CONTACTED', notes: 'Sent DM' }),
    })
  })
})
