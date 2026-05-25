import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

export async function POST(req: NextRequest) {
  const { postIds } = await req.json()

  if (!Array.isArray(postIds) || postIds.length === 0) {
    return NextResponse.json({ error: 'postIds must be a non-empty array' }, { status: 400 })
  }

  const posts = await prisma.post.findMany({
    where: { id: { in: postIds }, signal: null },
    select: { id: true },
  })

  let skipped = 0
  for (const post of posts) {
    await prisma.extractedSignal.upsert({
      where: { postId: post.id },
      create: {
        post: { connect: { id: post.id } },
        technologies: [],
        painPoints: [],
        seniority: 'unknown',
        remote: false,
        startupStage: 'unknown',
        matchScore: 0,
        summary: 'Manually skipped',
      },
      update: {
        matchScore: 0,
        summary: 'Manually skipped',
      },
    })
    skipped++
  }

  return NextResponse.json({ skipped })
}
