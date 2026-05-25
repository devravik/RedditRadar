import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    await prisma.blockedKeyword.delete({ where: { id } })
    return NextResponse.json({ ok: true })
  } catch (err: unknown) {
    if ((err as { code?: string }).code === 'P2025') {
      return NextResponse.json({ error: 'Keyword not found' }, { status: 404 })
    }
    console.error('DELETE /api/settings/blocked-keywords/[id] error:', err)
    return NextResponse.json({ error: 'Failed to delete keyword' }, { status: 500 })
  }
}
