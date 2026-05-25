import { NextRequest, NextResponse } from 'next/server'
import { analyzePost } from '@/lib/openai'
import { prisma } from '@/lib/db'

export async function POST(_req: NextRequest) {
  // Only fetch posts that have no ExtractedSignal yet
  let unanalyzed
  try {
    unanalyzed = await prisma.post.findMany({
      where: { signal: null },
      select: { id: true, title: true, body: true },
      take: 20, // batch limit to control OpenAI cost per call
    })
  } catch (err) {
    console.error('analyze findMany error:', err)
    return NextResponse.json({ error: 'Database error' }, { status: 500 })
  }

  let analyzed = 0
  for (const post of unanalyzed) {
    try {
      const result = await analyzePost(post.title, post.body)
      await prisma.extractedSignal.create({
        data: {
          postId: post.id,
          technologies: result.technologies,
          painPoints: result.painPoints,
          seniority: result.seniority,
          remote: result.remote,
          startupStage: result.startupStage,
          matchScore: result.matchScore,
          summary: result.summary,
        },
      })
      analyzed++
    } catch (err) {
      console.error(`Failed to analyze post ${post.id}:`, err)
    }
  }

  return NextResponse.json({ analyzed })
}
