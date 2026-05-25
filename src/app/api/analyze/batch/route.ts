import { NextRequest, NextResponse } from 'next/server'
import { analyzePost } from '@/lib/openai'
import { shouldSkipPost } from '@/lib/prefilter'
import { prisma } from '@/lib/db'

export async function POST(req: NextRequest) {
  const { postIds } = await req.json()

  if (!Array.isArray(postIds) || postIds.length === 0) {
    return NextResponse.json({ error: 'postIds must be a non-empty array' }, { status: 400 })
  }

  const posts = await prisma.post.findMany({
    where: { id: { in: postIds }, signal: null },
    select: { id: true, title: true, body: true, score: true, numComments: true },
  })

  if (posts.length === 0) {
    return NextResponse.json({ analyzed: 0, skipped: 0, preFiltered: 0, errors: 0 })
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

  let analyzed = 0
  let preFiltered = 0
  let errors = 0

  for (const post of posts) {
    const skip = shouldSkipPost(post.title, post.body, post.score, post.numComments)
    if (skip.skip) {
      preFiltered++
      continue
    }

    try {
      const result = await analyzePost(post.title, post.body, engineerProfile, aiProvider, aiModel)

      const data = {
        technologies: Array.isArray(result.technologies) ? result.technologies.filter(Boolean) : [],
        painPoints: Array.isArray(result.painPoints) ? result.painPoints.filter(Boolean) : [],
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
      }

      analyzed++
    } catch (err) {
      console.error(`Failed to analyze post ${post.id}:`, err)
      errors++
    }
  }

  const skipped = posts.length - analyzed - preFiltered - errors
  return NextResponse.json({ analyzed, preFiltered, skipped, errors })
}
