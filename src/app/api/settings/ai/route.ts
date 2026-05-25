import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

const VALID_PROVIDERS = ['openai', 'openrouter', 'groq']

export async function GET() {
  const [provider, model] = await Promise.all([
    prisma.setting.findUnique({ where: { key: 'AI_PROVIDER' } }),
    prisma.setting.findUnique({ where: { key: 'AI_MODEL' } }),
  ])
  return NextResponse.json({
    provider: provider?.value ?? 'openai',
    model: model?.value ?? 'gpt-4o',
  })
}

export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json()

    if (body.provider) {
      if (!VALID_PROVIDERS.includes(body.provider)) {
        return NextResponse.json({ error: 'provider must be openai, openrouter, or groq' }, { status: 400 })
      }
      await prisma.setting.upsert({
        where: { key: 'AI_PROVIDER' },
        update: { value: body.provider },
        create: { key: 'AI_PROVIDER', value: body.provider },
      })
    }

    if (body.model) {
      if (!body.model.trim()) {
        return NextResponse.json({ error: 'model must not be empty' }, { status: 400 })
      }
      await prisma.setting.upsert({
        where: { key: 'AI_MODEL' },
        update: { value: body.model.trim() },
        create: { key: 'AI_MODEL', value: body.model.trim() },
      })
    }

    return await GET()
  } catch (err) {
    console.error('PATCH /api/settings/ai error:', err)
    return NextResponse.json({ error: 'Failed to update AI settings' }, { status: 500 })
  }
}
