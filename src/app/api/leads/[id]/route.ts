import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

const VALID_STATUSES = ['NEW', 'CONTACTED', 'REPLIED', 'ARCHIVED']

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const lead = await prisma.lead.findUnique({
    where: { id },
    include: {
      post: { include: { signal: true } },
      messages: { orderBy: { createdAt: 'desc' } },
    },
  })

  if (!lead) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json(lead)
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await req.json()

    const data: Record<string, unknown> = {}
    if (body.status) {
      if (!VALID_STATUSES.includes(body.status)) {
        return NextResponse.json({ error: `status must be one of ${VALID_STATUSES.join(', ')}` }, { status: 400 })
      }
      data.status = body.status
      if (body.status === 'CONTACTED') data.contactedAt = new Date()
    }
    if (body.notes !== undefined) data.notes = body.notes

    const lead = await prisma.lead.update({
      where: { id },
      data,
    })
    return NextResponse.json(lead)
  } catch (err: unknown) {
    const prismaErr = err as { code?: string }
    if (prismaErr.code === 'P2025') {
      return NextResponse.json({ error: 'Lead not found' }, { status: 404 })
    }
    console.error('PATCH /api/leads/[id] error:', err)
    return NextResponse.json({ error: 'Failed to update lead' }, { status: 500 })
  }
}
