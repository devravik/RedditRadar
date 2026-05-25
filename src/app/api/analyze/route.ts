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

  const [profileSetting, providerSetting, modelSetting] = await Promise.all([
    prisma.setting.findUnique({ where: { key: 'ENGINEER_PROFILE' } }),
    prisma.setting.findUnique({ where: { key: 'AI_PROVIDER' } }),
    prisma.setting.findUnique({ where: { key: 'AI_MODEL' } }),
  ])
  const engineerProfile = profileSetting?.value ?? ''
  const aiProvider = providerSetting?.value ?? 'openai'
  const aiModel = modelSetting?.value ?? 'gpt-4o'
  console.log(`[analyze] Provider: ${aiProvider}, Model: ${aiModel}`)

  console.log(`[analyze] ${unanalyzed.length} posts to analyze`)

  let analyzed = 0
  for (const post of unanalyzed) {
    console.log(`[analyze] Analyzing "${post.title.slice(0, 60)}"…`)
    try {
      const result = await analyzePost(post.title, post.body, engineerProfile, aiProvider, aiModel)
      console.log(`[analyze] → score ${result.matchScore} — ${result.summary}`)
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

  console.log(`[analyze] Done — ${analyzed}/${unanalyzed.length} posts analyzed`)
  return NextResponse.json({ analyzed })
}
