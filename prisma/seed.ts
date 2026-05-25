import 'dotenv/config'
import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'

const adapter = new PrismaPg(process.env.DATABASE_URL!)
const prisma = new PrismaClient({ adapter })

const DEFAULT_SUBREDDITS = [
  'forhire',
  'hiring',
  'startups',
  'SaaS',
  'webdev',
  'laravel',
  'golang',
  'remotework',
]

const DEFAULT_ENGINEER_PROFILE = `Backend engineer, 12+ years experience.
Core skills: Laravel, Go, PostgreSQL, Redis, API architecture, SaaS infrastructure, multi-tenant systems.
Seeking: freelance/contract, remote preferred.
Strong signal keywords: scaling, bottleneck, queue, multi-tenant, SaaS, backend, infrastructure, performance.`

const DEFAULT_BLOCKED_KEYWORDS = [
  '[For Hire]',
  '[Hiring]',
  'for hire',
  'looking for work',
  'looking for a job',
  'job seeker',
]

async function main() {
  for (const name of DEFAULT_SUBREDDITS) {
    await prisma.subreddit.upsert({
      where: { name },
      update: {},
      create: { name, enabled: true, fetchInterval: 'DAILY' },
    })
  }
  console.log(`Seeded ${DEFAULT_SUBREDDITS.length} subreddits`)

  await prisma.setting.upsert({
    where: { key: 'ENGINEER_PROFILE' },
    update: {},
    create: { key: 'ENGINEER_PROFILE', value: DEFAULT_ENGINEER_PROFILE },
  })
  console.log('Seeded ENGINEER_PROFILE setting')

  await prisma.setting.upsert({
    where: { key: 'FETCH_MAX_AGE_DAYS' },
    update: {},
    create: { key: 'FETCH_MAX_AGE_DAYS', value: '60' },
  })
  console.log('Seeded FETCH_MAX_AGE_DAYS setting')

  await prisma.setting.upsert({
    where: { key: 'AI_PROVIDER' },
    update: {},
    create: { key: 'AI_PROVIDER', value: 'openai' },
  })
  console.log('Seeded AI_PROVIDER setting')

  await prisma.setting.upsert({
    where: { key: 'AI_MODEL' },
    update: {},
    create: { key: 'AI_MODEL', value: 'gpt-4o' },
  })
  console.log('Seeded AI_MODEL setting')

  await prisma.setting.upsert({
    where: { key: 'LEAD_THRESHOLD' },
    update: {},
    create: { key: 'LEAD_THRESHOLD', value: '70' },
  })
  console.log('Seeded LEAD_THRESHOLD setting')

  await prisma.setting.upsert({
    where: { key: 'SENDER_NAME' },
    update: {},
    create: { key: 'SENDER_NAME', value: '' },
  })
  console.log('Seeded SENDER_NAME setting')

  for (const word of DEFAULT_BLOCKED_KEYWORDS) {
    await prisma.blockedKeyword.upsert({
      where: { word },
      update: {},
      create: { word },
    })
  }
  console.log(`Seeded ${DEFAULT_BLOCKED_KEYWORDS.length} blocked keywords`)
}

main()
  .catch(e => { console.error(e); process.exit(1) })
  .finally(() => prisma.$disconnect())
