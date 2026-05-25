import { NextRequest, NextResponse } from 'next/server'
import { generateOutreachMessage } from '@/lib/outreach'
import { prisma } from '@/lib/db'
import { MessageType } from '@/types'

const VALID_TYPES: MessageType[] = ['REDDIT_DM', 'EMAIL', 'LINKEDIN']

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { leadId, type } = body

    if (!leadId || !type) {
      return NextResponse.json({ error: 'leadId and type are required' }, { status: 400 })
    }
    if (!VALID_TYPES.includes(type)) {
      return NextResponse.json({ error: `type must be one of ${VALID_TYPES.join(', ')}` }, { status: 400 })
    }

    const lead = await prisma.lead.findUnique({
      where: { id: leadId },
      include: {
        post: {
          include: {
            signal: true,
          },
        },
      },
    })

    if (!lead || !lead.post.signal) {
      return NextResponse.json({ error: 'Lead not found or not yet analyzed' }, { status: 404 })
    }

    const [providerSetting, modelSetting, senderSetting] = await Promise.all([
      prisma.setting.findUnique({ where: { key: 'AI_PROVIDER' } }),
      prisma.setting.findUnique({ where: { key: 'AI_MODEL' } }),
      prisma.setting.findUnique({ where: { key: 'SENDER_NAME' } }),
    ])
    const aiProvider = providerSetting?.value ?? 'openai'
    const aiModel = modelSetting?.value ?? 'gpt-4o'
    const senderName = senderSetting?.value ?? ''

    console.log(`[generate-message] Provider: ${aiProvider}, Model: ${aiModel}`)

    const content = await generateOutreachMessage(
      { title: lead.post.title, body: lead.post.body, author: lead.post.author, subreddit: lead.post.subreddit },
      {
        technologies: lead.post.signal.technologies,
        painPoints: lead.post.signal.painPoints,
        startupStage: lead.post.signal.startupStage,
        summary: lead.post.signal.summary,
        matchScore: lead.post.signal.matchScore,
        remote: lead.post.signal.remote,
      },
      type as MessageType,
      senderName,
      aiProvider,
      aiModel
    )

    const message = await prisma.generatedMessage.create({
      data: { leadId, type, content },
    })

    return NextResponse.json(message, { status: 201 })
  } catch (err) {
    console.error('generate-message error:', err)
    return NextResponse.json({ error: 'Failed to generate message' }, { status: 500 })
  }
}
