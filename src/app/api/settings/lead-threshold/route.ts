import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

export async function GET() {
  const setting = await prisma.setting.findUnique({ where: { key: 'LEAD_THRESHOLD' } })
  return NextResponse.json({ threshold: parseInt(setting?.value ?? '70', 10) })
}

export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json()
    const threshold = parseInt(body.threshold, 10)
    if (isNaN(threshold) || threshold < 0 || threshold > 100) {
      return NextResponse.json({ error: 'threshold must be a number between 0 and 100' }, { status: 400 })
    }

    const setting = await prisma.setting.upsert({
      where: { key: 'LEAD_THRESHOLD' },
      update: { value: String(threshold) },
      create: { key: 'LEAD_THRESHOLD', value: String(threshold) },
    })
    return NextResponse.json({ threshold: parseInt(setting.value, 10) })
  } catch (err) {
    console.error('PATCH /api/settings/lead-threshold error:', err)
    return NextResponse.json({ error: 'Failed to update lead threshold' }, { status: 500 })
  }
}
