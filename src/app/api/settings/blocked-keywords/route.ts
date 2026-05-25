import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

export async function GET() {
  const keywords = await prisma.blockedKeyword.findMany({ orderBy: { word: 'asc' } })
  return NextResponse.json(keywords)
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const word = body.word?.trim()
    if (!word) {
      return NextResponse.json({ error: 'word is required' }, { status: 400 })
    }

    const keyword = await prisma.blockedKeyword.create({ data: { word } })
    return NextResponse.json(keyword, { status: 201 })
  } catch (err: unknown) {
    if ((err as { code?: string }).code === 'P2002') {
      return NextResponse.json({ error: 'Keyword already exists' }, { status: 409 })
    }
    console.error('POST /api/settings/blocked-keywords error:', err)
    return NextResponse.json({ error: 'Failed to add keyword' }, { status: 500 })
  }
}
