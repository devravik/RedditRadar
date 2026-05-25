import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

export async function GET() {
  const setting = await prisma.setting.findUnique({ where: { key: 'SENDER_NAME' } })
  return NextResponse.json({ name: setting?.value ?? '' })
}

export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json()
    const name = (body.name ?? '').trim()

    const setting = await prisma.setting.upsert({
      where: { key: 'SENDER_NAME' },
      update: { value: name },
      create: { key: 'SENDER_NAME', value: name },
    })
    return NextResponse.json({ name: setting.value })
  } catch (err) {
    console.error('PATCH /api/settings/sender-name error:', err)
    return NextResponse.json({ error: 'Failed to update sender name' }, { status: 500 })
  }
}
