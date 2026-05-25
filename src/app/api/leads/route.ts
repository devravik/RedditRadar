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
  try {
    const body = await req.json()
    if (!body.postId) {
      return NextResponse.json({ error: 'postId is required' }, { status: 400 })
    }

    const lead = await prisma.lead.create({
      data: { postId: body.postId },
    })
    return NextResponse.json(lead, { status: 201 })
  } catch (err: unknown) {
    const prismaErr = err as { code?: string }
    if (prismaErr.code === 'P2002') {
      return NextResponse.json({ error: 'Lead already exists for this post' }, { status: 409 })
    }
    if (prismaErr.code === 'P2003') {
      return NextResponse.json({ error: 'Post not found' }, { status: 422 })
    }
    console.error('POST /api/leads error:', err)
    return NextResponse.json({ error: 'Failed to create lead' }, { status: 500 })
  }
}
