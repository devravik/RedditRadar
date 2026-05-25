import { POST } from '@/app/api/analyze/route'
import { NextRequest } from 'next/server'

jest.mock('@/lib/openai')
jest.mock('@/lib/db', () => ({
  prisma: {
    post: {
      findMany: jest.fn(),
    },
    extractedSignal: {
      create: jest.fn().mockResolvedValue({ id: 'sig1' }),
    },
  },
}))

import { analyzePost } from '@/lib/openai'
import { prisma } from '@/lib/db'

const mockAnalysisResult = {
  technologies: ['Laravel'],
  painPoints: ['slow queries'],
  seniority: 'senior',
  remote: true,
  startupStage: 'growth',
  matchScore: 75,
  summary: 'SaaS backend scaling opportunity.',
}

const mockPost = {
  id: 'post1',
  title: 'Need backend help',
  body: 'Our Laravel app is slow',
}

describe('POST /api/analyze', () => {
  beforeEach(() => jest.clearAllMocks())

  it('analyzes unanalyzed posts and returns count', async () => {
    ;(prisma.post.findMany as jest.Mock).mockResolvedValue([mockPost])
    ;(analyzePost as jest.Mock).mockResolvedValue(mockAnalysisResult)

    const req = new NextRequest('http://localhost/api/analyze', { method: 'POST' })
    const res = await POST(req)
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.analyzed).toBe(1)
  })

  it('creates ExtractedSignal with correct data', async () => {
    ;(prisma.post.findMany as jest.Mock).mockResolvedValue([mockPost])
    ;(analyzePost as jest.Mock).mockResolvedValue(mockAnalysisResult)

    const req = new NextRequest('http://localhost/api/analyze', { method: 'POST' })
    await POST(req)

    expect(prisma.extractedSignal.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        postId: 'post1',
        matchScore: 75,
        technologies: ['Laravel'],
        painPoints: ['slow queries'],
      }),
    })
  })

  it('returns 0 when no unanalyzed posts exist', async () => {
    ;(prisma.post.findMany as jest.Mock).mockResolvedValue([])

    const req = new NextRequest('http://localhost/api/analyze', { method: 'POST' })
    const res = await POST(req)
    const body = await res.json()

    expect(body.analyzed).toBe(0)
    expect(analyzePost).not.toHaveBeenCalled()
  })
})
