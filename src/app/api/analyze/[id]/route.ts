import { NextResponse } from 'next/server'
import { analyzePost } from '@/lib/openai'
import { shouldSkipPost } from '@/lib/prefilter'
import { prisma } from '@/lib/db'

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params

  const post = await prisma.post.findUnique({
    where: { id },
    select: { id: true, title: true, body: true, score: true, numComments: true, signal: true },
  })

  if (!post) {
    return NextResponse.json({ error: 'Post not found' }, { status: 404 })
  }

  if (post.signal) {
    return NextResponse.json({ error: 'Post already analyzed' }, { status: 409 })
  }

  const skip = shouldSkipPost(post.title, post.body, post.score, post.numComments)
  if (skip.skip) {
    return NextResponse.json({ error: `Pre-filtered: ${skip.reason}`, preFiltered: true, reason: skip.reason }, { status: 422 })
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

    const signal = await prisma.extractedSignal.upsert({
      where: { postId: post.id },
      create: { post: { connect: { id: post.id } }, ...data },
      update: data,
    })

    let lead = null
    if (result.matchScore >= leadThreshold) {
      lead = await prisma.lead.upsert({
        where: { postId: post.id },
        create: { postId: post.id },
        update: {},
      })
    }

    return NextResponse.json({ signal, lead, matchScore: result.matchScore })
  } catch (err) {
    console.error(`Failed to analyze post ${post.id}:`, err)
    return NextResponse.json({ error: 'Analysis failed' }, { status: 500 })
  }
}
