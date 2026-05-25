import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

export async function GET() {
  const setting = await prisma.setting.findUnique({ where: { key: 'FETCH_MAX_AGE_DAYS' } })
  return NextResponse.json({ days: parseInt(setting?.value ?? '60', 10) })
}

export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json()
    const days = parseInt(body.days, 10)
    if (isNaN(days) || days < 1 || days > 365) {
      return NextResponse.json({ error: 'days must be a number between 1 and 365' }, { status: 400 })
    }

    const setting = await prisma.setting.upsert({
      where: { key: 'FETCH_MAX_AGE_DAYS' },
      update: { value: String(days) },
      create: { key: 'FETCH_MAX_AGE_DAYS', value: String(days) },
    })
    return NextResponse.json({ days: parseInt(setting.value, 10) })
  } catch (err) {
    console.error('PATCH /api/settings/fetch-age error:', err)
    return NextResponse.json({ error: 'Failed to update max age' }, { status: 500 })
  }
}
