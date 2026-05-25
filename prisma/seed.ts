import 'dotenv/config'
import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! })
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

async function main() {
  for (const name of DEFAULT_SUBREDDITS) {
    await prisma.subreddit.upsert({
      where: { name },
      update: {},
      create: { name, enabled: true, fetchInterval: 'DAILY' },
    })
  }
  console.log(`Seeded ${DEFAULT_SUBREDDITS.length} subreddits`)
}

main()
  .catch(e => { console.error(e); process.exit(1) })
  .finally(() => prisma.$disconnect())
