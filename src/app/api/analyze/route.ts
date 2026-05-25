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

  const [profileSetting, providerSetting, modelSetting, thresholdSetting] = await Promise.all([
    prisma.setting.findUnique({ where: { key: 'ENGINEER_PROFILE' } }),
    prisma.setting.findUnique({ where: { key: 'AI_PROVIDER' } }),
    prisma.setting.findUnique({ where: { key: 'AI_MODEL' } }),
    prisma.setting.findUnique({ where: { key: 'LEAD_THRESHOLD' } }),
  ])
  const engineerProfile = profileSetting?.value ?? ''
  const aiProvider = providerSetting?.value ?? 'openai'
  const aiModel = modelSetting?.value ?? 'gpt-4o'
  const leadThreshold = parseInt(thresholdSetting?.value ?? '70', 10)
  console.log(`[analyze] Provider: ${aiProvider}, Model: ${aiModel}, Threshold: ${leadThreshold}`)

  console.log(`[analyze] ${unanalyzed.length} posts to analyze`)

  let analyzed = 0
  for (const post of unanalyzed) {
    console.log(`[analyze] Analyzing "${post.title.slice(0, 60)}"…`)
    try {
      const result = await analyzePost(post.title, post.body, engineerProfile, aiProvider, aiModel)
      console.log(`[analyze] → score ${result.matchScore} — ${result.summary}`)

      const data = {
        technologies: (result.technologies ?? []).filter(Boolean),
        painPoints: (result.painPoints ?? []).filter(Boolean),
        seniority: String(result.seniority ?? 'unknown'),
        remote: result.remote === true || String(result.remote) === 'true',
        startupStage: String(result.startupStage ?? 'unknown'),
        matchScore: Number(result.matchScore) || 0,
        summary: String(result.summary ?? ''),
      }

      await prisma.extractedSignal.upsert({
        where: { postId: post.id },
        create: { post: { connect: { id: post.id } }, ...data },
        update: data,
      })

      if (result.matchScore >= leadThreshold) {
        await prisma.lead.upsert({
          where: { postId: post.id },
          create: { postId: post.id },
          update: {},
        })
        console.log(`[analyze] → lead auto-created (score ${result.matchScore} >= ${leadThreshold})`)
      }

      analyzed++
    } catch (err) {
      console.error(`Failed to analyze post ${post.id}:`, err)
    }
  }

  console.log(`[analyze] Done — ${analyzed}/${unanalyzed.length} posts analyzed`)
  return NextResponse.json({ analyzed })
}
