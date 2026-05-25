import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

export async function GET(_req: NextRequest) {
  const leads = await prisma.lead.findMany({
    include: {
      post: {
        include: { signal: { select: { matchScore: true, technologies: true, painPoints: true, summary: true } } },
      },
      messages: { select: { id: true, type: true, createdAt: true } },
    },
    orderBy: { createdAt: 'desc' },
  })
  return NextResponse.json(leads)
}

export async function POST(req: NextRequest) {
  const body = await req.json()
  if (!body.postId) {
    return NextResponse.json({ error: 'postId is required' }, { status: 400 })
  }

  const lead = await prisma.lead.create({
    data: { postId: body.postId },
  })
  return NextResponse.json(lead, { status: 201 })
}
