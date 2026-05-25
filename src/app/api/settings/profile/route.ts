import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

export async function GET() {
  const setting = await prisma.setting.findUnique({ where: { key: 'ENGINEER_PROFILE' } })
  return NextResponse.json({ profile: setting?.value ?? '' })
}

export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json()
    if (typeof body.profile !== 'string') {
      return NextResponse.json({ error: 'profile must be a string' }, { status: 400 })
    }

    const setting = await prisma.setting.upsert({
      where: { key: 'ENGINEER_PROFILE' },
      update: { value: body.profile },
      create: { key: 'ENGINEER_PROFILE', value: body.profile },
    })
    return NextResponse.json({ profile: setting.value })
  } catch (err) {
    console.error('PATCH /api/settings/profile error:', err)
    return NextResponse.json({ error: 'Failed to update profile' }, { status: 500 })
  }
}
