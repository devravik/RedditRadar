import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

export async function POST() {
  const thresholdSetting = await prisma.setting.findUnique({ where: { key: 'LEAD_THRESHOLD' } })
  const threshold = parseInt(thresholdSetting?.value ?? '70', 10)

  const signals = await prisma.extractedSignal.findMany({
    where: {
      matchScore: { gte: threshold },
      post: { lead: null },
    },
    select: { postId: true, matchScore: true },
  })

  if (signals.length === 0) {
    return NextResponse.json({ created: 0, threshold })
  }

  for (const signal of signals) {
    await prisma.lead.upsert({
      where: { postId: signal.postId },
      create: { postId: signal.postId },
      update: {},
    })
  }

  console.log(`[generate-leads] Created ${signals.length} leads (threshold >= ${threshold})`)
  return NextResponse.json({ created: signals.length, threshold })
}
