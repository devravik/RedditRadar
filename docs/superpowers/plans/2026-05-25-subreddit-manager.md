# Subreddit Manager Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the hardcoded `SUBREDDITS` array with a database-driven subreddit manager featuring per-subreddit scheduling (Hourly/Daily/Weekly), a settings page at `/settings/subreddits`, and CSV import/export.

**Architecture:** New `Subreddit` Prisma model stores name, enabled flag, fetch interval, and lastFetchedAt. The Reddit fetcher queries this table at runtime to determine which subreddits are due. A settings page with four small client components handles CRUD. Six new API routes handle the data layer. The hardcoded `SUBREDDITS` constant and `fetchAllSubredditPosts` are deleted.

**Tech Stack:** Next.js 16, Prisma v7, TypeScript, TailwindCSS, shadcn/ui, Jest

---

## File Map

```
Modified:
  prisma/schema.prisma                          add Subreddit model + FetchInterval enum
  src/types/index.ts                            add FetchInterval type
  src/lib/reddit.ts                             replace SUBREDDITS + fetchAllSubredditPosts with fetchDueSubredditPosts
  src/lib/__tests__/reddit.test.ts              replace fetchAllSubredditPosts tests with fetchDueSubredditPosts tests
  src/app/api/fetch-posts/route.ts              use fetchDueSubredditPosts, return subreddits[]
  src/app/api/__tests__/fetch-posts.test.ts     mock fetchDueSubredditPosts instead of fetchAllSubredditPosts
  src/components/pipeline-buttons.tsx           show fetched subreddit names in feedback message
  src/app/layout.tsx                            add Settings nav link

Created:
  prisma/seed.ts                                seed 8 default subreddits
  src/app/api/subreddits/route.ts               GET list, POST create
  src/app/api/subreddits/[id]/route.ts          PATCH update, DELETE remove
  src/app/api/subreddits/export/route.ts        GET CSV download
  src/app/api/subreddits/import/route.ts        POST CSV merge
  src/app/api/__tests__/subreddits.test.ts      tests for all 6 subreddit routes
  src/app/settings/subreddits/page.tsx          server component settings page
  src/components/subreddit-toggle.tsx           enabled on/off toggle (client)
  src/components/interval-select.tsx            Hourly/Daily/Weekly selector (client)
  src/components/add-subreddit-form.tsx         add subreddit form (client)
  src/components/delete-subreddit-button.tsx    delete with confirmation (client)
  src/components/csv-import-button.tsx          file picker + POST import (client)
```

---

## Task 1: Schema + Types + Seed

**Files:**
- Modify: `prisma/schema.prisma`
- Modify: `src/types/index.ts`
- Create: `prisma/seed.ts`
- Modify: `package.json`

- [ ] **Step 1: Add FetchInterval type to shared types**

Edit `src/types/index.ts` - add after the existing types:

```typescript
export type FetchInterval = 'HOURLY' | 'DAILY' | 'WEEKLY'
```

- [ ] **Step 2: Add Subreddit model to Prisma schema**

Edit `prisma/schema.prisma` - append after the `MessageType` enum:

```prisma
model Subreddit {
  id            String        @id @default(cuid())
  name          String        @unique
  enabled       Boolean       @default(true)
  fetchInterval FetchInterval @default(DAILY)
  lastFetchedAt DateTime?
  createdAt     DateTime      @default(now())
}

enum FetchInterval {
  HOURLY
  DAILY
  WEEKLY
}
```

- [ ] **Step 3: Run migration**

```bash
npx prisma migrate dev --name add-subreddit-table
```

Expected: `prisma/migrations/..._add-subreddit-table/migration.sql` created, migration applied.

- [ ] **Step 4: Install tsx for seed script**

```bash
npm install -D tsx
```

- [ ] **Step 5: Configure package.json for seeding**

Add a `"prisma"` field to `package.json` (at the top level alongside `"scripts"`):

```json
"prisma": {
  "seed": "npx tsx prisma/seed.ts"
}
```

- [ ] **Step 6: Write the seed script**

Create `prisma/seed.ts`:

```typescript
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
```

- [ ] **Step 7: Run seed**

```bash
npx prisma db seed
```

Expected: `Seeded 8 subreddits`

- [ ] **Step 8: Verify TypeScript**

```bash
npx tsc --noEmit
```

Expected: zero errors.

- [ ] **Step 9: Commit**

```bash
git add prisma/ src/types/index.ts package.json
git commit -m "feat: add Subreddit model with FetchInterval scheduling + seed"
```

---

## Task 2: fetchDueSubredditPosts (TDD)

**Files:**
- Modify: `src/lib/__tests__/reddit.test.ts`
- Modify: `src/lib/reddit.ts`

- [ ] **Step 1: Replace the test file**

Replace the full contents of `src/lib/__tests__/reddit.test.ts`:

```typescript
import { fetchSubredditPosts, fetchDueSubredditPosts } from '@/lib/reddit'
import { RedditPost } from '@/types'

jest.mock('@/lib/db', () => ({
  prisma: {
    subreddit: {
      findMany: jest.fn(),
      update: jest.fn().mockResolvedValue({}),
    },
  },
}))

import { prisma } from '@/lib/db'

const mockPost = (id: string, subreddit: string): RedditPost => ({
  id,
  subreddit,
  title: `Test post in ${subreddit}`,
  selftext: 'We need backend help',
  author: 'founder_bob',
  url: `https://reddit.com/r/${subreddit}/comments/${id}`,
  created_utc: 1716825600,
  score: 5,
  num_comments: 2,
})

function makeRedditResponse(posts: RedditPost[]) {
  return { data: { children: posts.map(p => ({ data: p })) } }
}

describe('fetchSubredditPosts', () => {
  beforeEach(() => jest.resetAllMocks())

  it('returns parsed posts for a subreddit', async () => {
    const posts = [mockPost('abc', 'startups'), mockPost('def', 'startups')]
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => makeRedditResponse(posts),
    } as Response)

    const result = await fetchSubredditPosts('startups')

    expect(global.fetch).toHaveBeenCalledWith(
      'https://www.reddit.com/r/startups/new.json?limit=25',
      expect.objectContaining({ headers: expect.any(Object) })
    )
    expect(result).toHaveLength(2)
    expect(result[0].id).toBe('abc')
  })

  it('throws when Reddit returns non-OK status', async () => {
    global.fetch = jest.fn().mockResolvedValue({ ok: false, status: 429 } as Response)
    await expect(fetchSubredditPosts('startups')).rejects.toThrow('Reddit API error: 429')
  })
})

describe('fetchDueSubredditPosts', () => {
  beforeEach(() => jest.clearAllMocks())

  it('returns empty when no enabled subreddits in DB', async () => {
    ;(prisma.subreddit.findMany as jest.Mock).mockResolvedValue([])
    global.fetch = jest.fn()

    const result = await fetchDueSubredditPosts()

    expect(result.posts).toHaveLength(0)
    expect(result.subreddits).toHaveLength(0)
    expect(global.fetch).not.toHaveBeenCalled()
  })

  it('fetches subreddit with null lastFetchedAt (never fetched)', async () => {
    ;(prisma.subreddit.findMany as jest.Mock).mockResolvedValue([
      { id: 's1', name: 'startups', fetchInterval: 'DAILY', lastFetchedAt: null },
    ])
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => makeRedditResponse([mockPost('a', 'startups')]),
    } as Response)

    const result = await fetchDueSubredditPosts()

    expect(result.subreddits).toEqual(['startups'])
    expect(result.posts).toHaveLength(1)
  })

  it('skips subreddit fetched within DAILY interval (not yet due)', async () => {
    const recentDate = new Date(Date.now() - 60 * 60 * 1000) // 1 hour ago
    ;(prisma.subreddit.findMany as jest.Mock).mockResolvedValue([
      { id: 's1', name: 'startups', fetchInterval: 'DAILY', lastFetchedAt: recentDate },
    ])
    global.fetch = jest.fn()

    const result = await fetchDueSubredditPosts()

    expect(result.subreddits).toHaveLength(0)
    expect(global.fetch).not.toHaveBeenCalled()
  })

  it('fetches subreddit past HOURLY interval (overdue)', async () => {
    const oldDate = new Date(Date.now() - 2 * 60 * 60 * 1000) // 2 hours ago
    ;(prisma.subreddit.findMany as jest.Mock).mockResolvedValue([
      { id: 's1', name: 'laravel', fetchInterval: 'HOURLY', lastFetchedAt: oldDate },
    ])
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => makeRedditResponse([mockPost('b', 'laravel')]),
    } as Response)

    const result = await fetchDueSubredditPosts()

    expect(result.subreddits).toContain('laravel')
    expect(result.posts).toHaveLength(1)
  })

  it('updates lastFetchedAt after successful fetch', async () => {
    ;(prisma.subreddit.findMany as jest.Mock).mockResolvedValue([
      { id: 's1', name: 'golang', fetchInterval: 'DAILY', lastFetchedAt: null },
    ])
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => makeRedditResponse([]),
    } as Response)

    await fetchDueSubredditPosts()

    expect(prisma.subreddit.update).toHaveBeenCalledWith({
      where: { id: 's1' },
      data: { lastFetchedAt: expect.any(Date) },
    })
  })

  it('skips subreddit on fetch error and does not update lastFetchedAt', async () => {
    ;(prisma.subreddit.findMany as jest.Mock).mockResolvedValue([
      { id: 's1', name: 'forhire', fetchInterval: 'DAILY', lastFetchedAt: null },
    ])
    global.fetch = jest.fn().mockResolvedValue({ ok: false, status: 503 } as Response)

    const result = await fetchDueSubredditPosts()

    expect(result.subreddits).toHaveLength(0)
    expect(prisma.subreddit.update).not.toHaveBeenCalled()
  })
})
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
npm test -- src/lib/__tests__/reddit.test.ts
```

Expected: FAIL - `fetchDueSubredditPosts is not a function`

- [ ] **Step 3: Replace reddit.ts**

Replace the full contents of `src/lib/reddit.ts`:

```typescript
import { prisma } from '@/lib/db'
import { FetchInterval, RedditPost } from '@/types'

const INTERVAL_MS: Record<FetchInterval, number> = {
  HOURLY: 60 * 60 * 1000,
  DAILY: 24 * 60 * 60 * 1000,
  WEEKLY: 7 * 24 * 60 * 60 * 1000,
}

export async function fetchSubredditPosts(subreddit: string, limit = 25): Promise<RedditPost[]> {
  const res = await fetch(
    `https://www.reddit.com/r/${subreddit}/new.json?limit=${limit}`,
    { headers: { 'User-Agent': 'RedditRadar/1.0 (lead-discovery)' } }
  )
  if (!res.ok) throw new Error(`Reddit API error: ${res.status}`)
  const json = await res.json()
  return json.data.children.map((child: { data: RedditPost }) => child.data)
}

export async function fetchDueSubredditPosts(): Promise<{ posts: RedditPost[]; subreddits: string[] }> {
  const all = await prisma.subreddit.findMany({ where: { enabled: true } })

  const due = all.filter(s =>
    !s.lastFetchedAt ||
    Date.now() - s.lastFetchedAt.getTime() >= INTERVAL_MS[s.fetchInterval as FetchInterval]
  )

  const posts: RedditPost[] = []
  const subreddits: string[] = []

  for (const sub of due) {
    try {
      const fetched = await fetchSubredditPosts(sub.name)
      posts.push(...fetched)
      subreddits.push(sub.name)
      await prisma.subreddit.update({
        where: { id: sub.id },
        data: { lastFetchedAt: new Date() },
      })
    } catch (err) {
      console.error(`Failed to fetch r/${sub.name}:`, err)
    }
  }

  return { posts, subreddits }
}
```

- [ ] **Step 4: Run tests to confirm they pass**

```bash
npm test -- src/lib/__tests__/reddit.test.ts
```

Expected: PASS - 8 tests pass

- [ ] **Step 5: Commit**

```bash
git add src/lib/reddit.ts src/lib/__tests__/reddit.test.ts
git commit -m "feat: replace hardcoded SUBREDDITS with DB-driven fetchDueSubredditPosts"
```

---

## Task 3: Subreddits API - GET + POST (TDD)

**Files:**
- Create: `src/app/api/subreddits/route.ts`
- Create: `src/app/api/__tests__/subreddits.test.ts` (partial - GET + POST tests only)

- [ ] **Step 1: Write failing tests for GET and POST**

Create `src/app/api/__tests__/subreddits.test.ts`:

```typescript
import { GET, POST } from '@/app/api/subreddits/route'
import { NextRequest } from 'next/server'

jest.mock('@/lib/db', () => ({
  prisma: {
    subreddit: {
      findMany: jest.fn(),
      create: jest.fn(),
    },
  },
}))

import { prisma } from '@/lib/db'

const mockSub = {
  id: 'sub1',
  name: 'startups',
  enabled: true,
  fetchInterval: 'DAILY',
  lastFetchedAt: null,
  createdAt: new Date(),
}

describe('GET /api/subreddits', () => {
  it('returns all subreddits ordered by name', async () => {
    ;(prisma.subreddit.findMany as jest.Mock).mockResolvedValue([mockSub])

    const req = new NextRequest('http://localhost/api/subreddits')
    const res = await GET(req)
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body).toHaveLength(1)
    expect(body[0].name).toBe('startups')
    expect(prisma.subreddit.findMany).toHaveBeenCalledWith({ orderBy: { name: 'asc' } })
  })
})

describe('POST /api/subreddits', () => {
  beforeEach(() => jest.clearAllMocks())

  it('creates a subreddit and normalizes name (strips r/, lowercases)', async () => {
    ;(prisma.subreddit.create as jest.Mock).mockResolvedValue(mockSub)

    const req = new NextRequest('http://localhost/api/subreddits', {
      method: 'POST',
      body: JSON.stringify({ name: 'r/Startups', fetchInterval: 'DAILY' }),
      headers: { 'Content-Type': 'application/json' },
    })
    const res = await POST(req)

    expect(res.status).toBe(201)
    expect(prisma.subreddit.create).toHaveBeenCalledWith({
      data: { name: 'startups', fetchInterval: 'DAILY', enabled: true },
    })
  })

  it('defaults fetchInterval to DAILY when not provided', async () => {
    ;(prisma.subreddit.create as jest.Mock).mockResolvedValue(mockSub)

    const req = new NextRequest('http://localhost/api/subreddits', {
      method: 'POST',
      body: JSON.stringify({ name: 'golang' }),
      headers: { 'Content-Type': 'application/json' },
    })
    await POST(req)

    expect(prisma.subreddit.create).toHaveBeenCalledWith({
      data: { name: 'golang', fetchInterval: 'DAILY', enabled: true },
    })
  })

  it('returns 400 for invalid name (spaces, special chars)', async () => {
    const req = new NextRequest('http://localhost/api/subreddits', {
      method: 'POST',
      body: JSON.stringify({ name: 'invalid name!' }),
      headers: { 'Content-Type': 'application/json' },
    })
    const res = await POST(req)
    expect(res.status).toBe(400)
  })

  it('returns 400 when name is missing', async () => {
    const req = new NextRequest('http://localhost/api/subreddits', {
      method: 'POST',
      body: JSON.stringify({ fetchInterval: 'DAILY' }),
      headers: { 'Content-Type': 'application/json' },
    })
    const res = await POST(req)
    expect(res.status).toBe(400)
  })

  it('returns 409 when subreddit already exists', async () => {
    ;(prisma.subreddit.create as jest.Mock).mockRejectedValue({ code: 'P2002' })

    const req = new NextRequest('http://localhost/api/subreddits', {
      method: 'POST',
      body: JSON.stringify({ name: 'startups' }),
      headers: { 'Content-Type': 'application/json' },
    })
    const res = await POST(req)
    expect(res.status).toBe(409)
  })
})
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
npm test -- src/app/api/__tests__/subreddits.test.ts
```

Expected: FAIL - `Cannot find module '@/app/api/subreddits/route'`

- [ ] **Step 3: Implement GET + POST route**

Create `src/app/api/subreddits/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

const VALID_INTERVALS = ['HOURLY', 'DAILY', 'WEEKLY'] as const

function normalizeName(raw: string): string {
  return raw.trim().replace(/^r\//i, '').toLowerCase()
}

export async function GET(_req: NextRequest) {
  const subreddits = await prisma.subreddit.findMany({ orderBy: { name: 'asc' } })
  return NextResponse.json(subreddits)
}

export async function POST(req: NextRequest) {
  const body = await req.json()

  if (!body.name?.trim()) {
    return NextResponse.json({ error: 'name is required' }, { status: 400 })
  }

  const name = normalizeName(body.name)
  if (!/^[a-z0-9_]+$/.test(name)) {
    return NextResponse.json({ error: 'Invalid subreddit name - alphanumeric and underscores only' }, { status: 400 })
  }

  const fetchInterval = body.fetchInterval ?? 'DAILY'
  if (!VALID_INTERVALS.includes(fetchInterval)) {
    return NextResponse.json({ error: 'fetchInterval must be HOURLY, DAILY, or WEEKLY' }, { status: 400 })
  }

  try {
    const subreddit = await prisma.subreddit.create({
      data: { name, fetchInterval, enabled: true },
    })
    return NextResponse.json(subreddit, { status: 201 })
  } catch (err: unknown) {
    if ((err as { code?: string }).code === 'P2002') {
      return NextResponse.json({ error: 'Subreddit already exists' }, { status: 409 })
    }
    console.error('POST /api/subreddits error:', err)
    return NextResponse.json({ error: 'Failed to create subreddit' }, { status: 500 })
  }
}
```

- [ ] **Step 4: Run tests to confirm they pass**

```bash
npm test -- src/app/api/__tests__/subreddits.test.ts
```

Expected: PASS - 5 tests pass

- [ ] **Step 5: Commit**

```bash
git add src/app/api/subreddits/route.ts src/app/api/__tests__/subreddits.test.ts
git commit -m "feat: GET + POST /api/subreddits - list and create subreddits"
```

---

## Task 4: Subreddits API - PATCH + DELETE (TDD)

**Files:**
- Create: `src/app/api/subreddits/[id]/route.ts`
- Modify: `src/app/api/__tests__/subreddits.test.ts`

- [ ] **Step 1: Add PATCH + DELETE tests to the test file**

Append to `src/app/api/__tests__/subreddits.test.ts`:

```typescript
import { PATCH, DELETE } from '@/app/api/subreddits/[id]/route'

// Add subreddit.update and subreddit.delete to the existing mock
// by updating the jest.mock call at the top to include them:
// subreddit: { findMany: jest.fn(), create: jest.fn(), update: jest.fn(), delete: jest.fn() }
```

First, update the `jest.mock` call at the top of the file to add `update` and `delete`:

```typescript
jest.mock('@/lib/db', () => ({
  prisma: {
    subreddit: {
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
  },
}))
```

Then append these describe blocks at the bottom of the file:

```typescript
describe('PATCH /api/subreddits/[id]', () => {
  beforeEach(() => jest.clearAllMocks())

  it('updates enabled to false', async () => {
    ;(prisma.subreddit.update as jest.Mock).mockResolvedValue({ ...mockSub, enabled: false })

    const req = new NextRequest('http://localhost/api/subreddits/sub1', {
      method: 'PATCH',
      body: JSON.stringify({ enabled: false }),
      headers: { 'Content-Type': 'application/json' },
    })
    const res = await PATCH(req, { params: Promise.resolve({ id: 'sub1' }) })

    expect(res.status).toBe(200)
    expect(prisma.subreddit.update).toHaveBeenCalledWith({
      where: { id: 'sub1' },
      data: { enabled: false },
    })
  })

  it('updates fetchInterval', async () => {
    ;(prisma.subreddit.update as jest.Mock).mockResolvedValue({ ...mockSub, fetchInterval: 'WEEKLY' })

    const req = new NextRequest('http://localhost/api/subreddits/sub1', {
      method: 'PATCH',
      body: JSON.stringify({ fetchInterval: 'WEEKLY' }),
      headers: { 'Content-Type': 'application/json' },
    })
    const res = await PATCH(req, { params: Promise.resolve({ id: 'sub1' }) })

    expect(res.status).toBe(200)
    expect(prisma.subreddit.update).toHaveBeenCalledWith({
      where: { id: 'sub1' },
      data: { fetchInterval: 'WEEKLY' },
    })
  })

  it('returns 400 for invalid fetchInterval', async () => {
    const req = new NextRequest('http://localhost/api/subreddits/sub1', {
      method: 'PATCH',
      body: JSON.stringify({ fetchInterval: 'MONTHLY' }),
      headers: { 'Content-Type': 'application/json' },
    })
    const res = await PATCH(req, { params: Promise.resolve({ id: 'sub1' }) })
    expect(res.status).toBe(400)
  })

  it('returns 404 when subreddit not found', async () => {
    ;(prisma.subreddit.update as jest.Mock).mockRejectedValue({ code: 'P2025' })

    const req = new NextRequest('http://localhost/api/subreddits/notfound', {
      method: 'PATCH',
      body: JSON.stringify({ enabled: true }),
      headers: { 'Content-Type': 'application/json' },
    })
    const res = await PATCH(req, { params: Promise.resolve({ id: 'notfound' }) })
    expect(res.status).toBe(404)
  })
})

describe('DELETE /api/subreddits/[id]', () => {
  beforeEach(() => jest.clearAllMocks())

  it('deletes a subreddit and returns 200', async () => {
    ;(prisma.subreddit.delete as jest.Mock).mockResolvedValue(mockSub)

    const req = new NextRequest('http://localhost/api/subreddits/sub1')
    const res = await DELETE(req, { params: Promise.resolve({ id: 'sub1' }) })

    expect(res.status).toBe(200)
    expect(prisma.subreddit.delete).toHaveBeenCalledWith({ where: { id: 'sub1' } })
  })

  it('returns 404 when subreddit not found', async () => {
    ;(prisma.subreddit.delete as jest.Mock).mockRejectedValue({ code: 'P2025' })

    const req = new NextRequest('http://localhost/api/subreddits/notfound')
    const res = await DELETE(req, { params: Promise.resolve({ id: 'notfound' }) })
    expect(res.status).toBe(404)
  })
})
```

- [ ] **Step 2: Run tests to confirm the new ones fail**

```bash
npm test -- src/app/api/__tests__/subreddits.test.ts
```

Expected: FAIL - `Cannot find module '@/app/api/subreddits/[id]/route'`

- [ ] **Step 3: Implement PATCH + DELETE route**

Create `src/app/api/subreddits/[id]/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

const VALID_INTERVALS = ['HOURLY', 'DAILY', 'WEEKLY']

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await req.json()

    const data: Record<string, unknown> = {}
    if (body.enabled !== undefined) data.enabled = Boolean(body.enabled)
    if (body.fetchInterval !== undefined) {
      if (!VALID_INTERVALS.includes(body.fetchInterval)) {
        return NextResponse.json({ error: 'fetchInterval must be HOURLY, DAILY, or WEEKLY' }, { status: 400 })
      }
      data.fetchInterval = body.fetchInterval
    }

    const subreddit = await prisma.subreddit.update({ where: { id }, data })
    return NextResponse.json(subreddit)
  } catch (err: unknown) {
    if ((err as { code?: string }).code === 'P2025') {
      return NextResponse.json({ error: 'Subreddit not found' }, { status: 404 })
    }
    console.error('PATCH /api/subreddits/[id] error:', err)
    return NextResponse.json({ error: 'Failed to update subreddit' }, { status: 500 })
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    await prisma.subreddit.delete({ where: { id } })
    return NextResponse.json({ ok: true })
  } catch (err: unknown) {
    if ((err as { code?: string }).code === 'P2025') {
      return NextResponse.json({ error: 'Subreddit not found' }, { status: 404 })
    }
    console.error('DELETE /api/subreddits/[id] error:', err)
    return NextResponse.json({ error: 'Failed to delete subreddit' }, { status: 500 })
  }
}
```

- [ ] **Step 4: Run all subreddit tests**

```bash
npm test -- src/app/api/__tests__/subreddits.test.ts
```

Expected: PASS - 11 tests pass

- [ ] **Step 5: Commit**

```bash
git add src/app/api/subreddits/[id]/route.ts src/app/api/__tests__/subreddits.test.ts
git commit -m "feat: PATCH + DELETE /api/subreddits/[id] - update and remove subreddits"
```

---

## Task 5: Export + Import CSV Routes (TDD)

**Files:**
- Create: `src/app/api/subreddits/export/route.ts`
- Create: `src/app/api/subreddits/import/route.ts`
- Modify: `src/app/api/__tests__/subreddits.test.ts`

- [ ] **Step 1: Add export + import tests**

First update the jest.mock at the top of `src/app/api/__tests__/subreddits.test.ts` to add the `create` mock used by import (already there - no change needed).

Append to the bottom of `src/app/api/__tests__/subreddits.test.ts`:

```typescript
import { GET as EXPORT } from '@/app/api/subreddits/export/route'
import { POST as IMPORT } from '@/app/api/subreddits/import/route'

describe('GET /api/subreddits/export', () => {
  it('returns CSV with header row and one data row per subreddit', async () => {
    ;(prisma.subreddit.findMany as jest.Mock).mockResolvedValue([
      { name: 'startups', enabled: true, fetchInterval: 'DAILY' },
      { name: 'laravel', enabled: false, fetchInterval: 'HOURLY' },
    ])

    const req = new NextRequest('http://localhost/api/subreddits/export')
    const res = await EXPORT(req)
    const text = await res.text()

    expect(res.headers.get('Content-Type')).toContain('text/csv')
    expect(res.headers.get('Content-Disposition')).toContain('subreddits.csv')
    expect(text).toBe('name,enabled,fetchInterval\nstartups,true,DAILY\nlaravel,false,HOURLY')
  })
})

describe('POST /api/subreddits/import', () => {
  beforeEach(() => jest.clearAllMocks())

  it('adds new subreddits and returns added/skipped counts', async () => {
    ;(prisma.subreddit.create as jest.Mock)
      .mockResolvedValueOnce({ name: 'golang' })
      .mockRejectedValueOnce({ code: 'P2002' })

    const csv = 'name,enabled,fetchInterval\ngolang,true,DAILY\nstartups,true,DAILY'
    const req = new NextRequest('http://localhost/api/subreddits/import', {
      method: 'POST',
      body: csv,
      headers: { 'Content-Type': 'text/csv' },
    })
    const res = await IMPORT(req)
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.added).toBe(1)
    expect(body.skipped).toBe(1)
  })

  it('strips r/ prefix from imported names', async () => {
    ;(prisma.subreddit.create as jest.Mock).mockResolvedValue({ name: 'webdev' })

    const csv = 'name,enabled,fetchInterval\nr/webdev,true,DAILY'
    const req = new NextRequest('http://localhost/api/subreddits/import', {
      method: 'POST',
      body: csv,
      headers: { 'Content-Type': 'text/csv' },
    })
    await IMPORT(req)

    expect(prisma.subreddit.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ name: 'webdev' }),
    })
  })

  it('skips rows with invalid names', async () => {
    const csv = 'name,enabled,fetchInterval\ninvalid name!,true,DAILY\ngolang,true,DAILY'
    ;(prisma.subreddit.create as jest.Mock).mockResolvedValue({ name: 'golang' })

    const req = new NextRequest('http://localhost/api/subreddits/import', {
      method: 'POST',
      body: csv,
      headers: { 'Content-Type': 'text/csv' },
    })
    const res = await IMPORT(req)
    const body = await res.json()

    expect(body.added).toBe(1)
    expect(body.skipped).toBe(1)
  })

  it('works without header row', async () => {
    ;(prisma.subreddit.create as jest.Mock).mockResolvedValue({ name: 'hiring' })

    const csv = 'hiring,true,DAILY'
    const req = new NextRequest('http://localhost/api/subreddits/import', {
      method: 'POST',
      body: csv,
      headers: { 'Content-Type': 'text/csv' },
    })
    const res = await IMPORT(req)
    const body = await res.json()

    expect(body.added).toBe(1)
  })
})
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
npm test -- src/app/api/__tests__/subreddits.test.ts
```

Expected: FAIL on export and import tests (modules not found)

- [ ] **Step 3: Implement export route**

Create `src/app/api/subreddits/export/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

export async function GET(_req: NextRequest) {
  const subreddits = await prisma.subreddit.findMany({ orderBy: { name: 'asc' } })

  const rows = subreddits.map(s => `${s.name},${s.enabled},${s.fetchInterval}`)
  const csv = ['name,enabled,fetchInterval', ...rows].join('\n')

  return new NextResponse(csv, {
    headers: {
      'Content-Type': 'text/csv',
      'Content-Disposition': 'attachment; filename="subreddits.csv"',
    },
  })
}
```

- [ ] **Step 4: Implement import route**

Create `src/app/api/subreddits/import/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

const VALID_INTERVALS = ['HOURLY', 'DAILY', 'WEEKLY']

export async function POST(req: NextRequest) {
  try {
    const csv = await req.text()
    const lines = csv.trim().split('\n').map(l => l.trim()).filter(Boolean)

    // Skip header row if present
    const dataLines = lines[0]?.startsWith('name') ? lines.slice(1) : lines

    let added = 0
    let skipped = 0

    for (const line of dataLines) {
      const parts = line.split(',')
      const rawName = parts[0]?.trim()
      if (!rawName) { skipped++; continue }

      const name = rawName.replace(/^r\//i, '').toLowerCase()
      if (!/^[a-z0-9_]+$/.test(name)) { skipped++; continue }

      const fetchInterval = VALID_INTERVALS.includes(parts[2]?.trim())
        ? parts[2].trim()
        : 'DAILY'

      try {
        await prisma.subreddit.create({ data: { name, fetchInterval, enabled: true } })
        added++
      } catch (err: unknown) {
        if ((err as { code?: string }).code === 'P2002') { skipped++; continue }
        throw err
      }
    }

    return NextResponse.json({ added, skipped })
  } catch (err) {
    console.error('POST /api/subreddits/import error:', err)
    return NextResponse.json({ error: 'Failed to import CSV' }, { status: 500 })
  }
}
```

- [ ] **Step 5: Run all subreddit tests**

```bash
npm test -- src/app/api/__tests__/subreddits.test.ts
```

Expected: PASS - 15 tests pass

- [ ] **Step 6: Commit**

```bash
git add src/app/api/subreddits/export/ src/app/api/subreddits/import/ src/app/api/__tests__/subreddits.test.ts
git commit -m "feat: CSV export and merge-import for subreddits"
```

---

## Task 6: Update Fetch-Posts Route + Pipeline Buttons

**Files:**
- Modify: `src/app/api/fetch-posts/route.ts`
- Modify: `src/app/api/__tests__/fetch-posts.test.ts`
- Modify: `src/components/pipeline-buttons.tsx`

- [ ] **Step 1: Update fetch-posts test to use fetchDueSubredditPosts**

Replace the full contents of `src/app/api/__tests__/fetch-posts.test.ts`:

```typescript
import { POST } from '@/app/api/fetch-posts/route'
import { NextRequest } from 'next/server'

jest.mock('@/lib/reddit')
jest.mock('@/lib/db', () => ({
  prisma: {
    post: {
      upsert: jest.fn().mockResolvedValue({ id: 'cuid1' }),
    },
  },
}))

import { fetchDueSubredditPosts } from '@/lib/reddit'
import { prisma } from '@/lib/db'

const mockRedditPost = {
  id: 'abc123',
  subreddit: 'startups',
  title: 'Need backend engineer',
  selftext: 'Looking for Laravel help',
  author: 'founder_x',
  url: 'https://reddit.com/r/startups/comments/abc123',
  created_utc: 1716825600,
  score: 10,
  num_comments: 3,
}

describe('POST /api/fetch-posts', () => {
  beforeEach(() => jest.clearAllMocks())

  it('returns 200 with count and subreddit names', async () => {
    ;(fetchDueSubredditPosts as jest.Mock).mockResolvedValue({
      posts: [mockRedditPost],
      subreddits: ['startups'],
    })

    const req = new NextRequest('http://localhost/api/fetch-posts', { method: 'POST' })
    const res = await POST(req)
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.fetched).toBe(1)
    expect(body.subreddits).toEqual(['startups'])
  })

  it('calls prisma.post.upsert with correct shape', async () => {
    ;(fetchDueSubredditPosts as jest.Mock).mockResolvedValue({
      posts: [mockRedditPost],
      subreddits: ['startups'],
    })

    const req = new NextRequest('http://localhost/api/fetch-posts', { method: 'POST' })
    await POST(req)

    expect(prisma.post.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { redditId: 'abc123' },
        create: expect.objectContaining({
          redditId: 'abc123',
          subreddit: 'startups',
          title: 'Need backend engineer',
        }),
      })
    )
  })

  it('returns 500 when fetch fails', async () => {
    ;(fetchDueSubredditPosts as jest.Mock).mockRejectedValue(new Error('db error'))

    const req = new NextRequest('http://localhost/api/fetch-posts', { method: 'POST' })
    const res = await POST(req)

    expect(res.status).toBe(500)
  })
})
```

- [ ] **Step 2: Run the test to confirm it fails**

```bash
npm test -- src/app/api/__tests__/fetch-posts.test.ts
```

Expected: FAIL - `fetchDueSubredditPosts` not mocked / wrong signature

- [ ] **Step 3: Update fetch-posts route**

Replace the full contents of `src/app/api/fetch-posts/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { fetchDueSubredditPosts } from '@/lib/reddit'
import { prisma } from '@/lib/db'

export async function POST(_req: NextRequest) {
  try {
    const { posts, subreddits } = await fetchDueSubredditPosts()

    await Promise.all(
      posts.map(p =>
        prisma.post.upsert({
          where: { redditId: p.id },
          create: {
            redditId: p.id,
            subreddit: p.subreddit,
            title: p.title,
            body: p.selftext,
            author: p.author,
            url: p.url,
            postedAt: new Date(p.created_utc * 1000),
            score: p.score,
            numComments: p.num_comments,
          },
          update: {
            score: p.score,
            numComments: p.num_comments,
          },
        })
      )
    )

    return NextResponse.json({ fetched: posts.length, subreddits })
  } catch (err) {
    console.error('fetch-posts error:', err)
    return NextResponse.json({ error: 'Failed to fetch posts' }, { status: 500 })
  }
}
```

- [ ] **Step 4: Run fetch-posts tests**

```bash
npm test -- src/app/api/__tests__/fetch-posts.test.ts
```

Expected: PASS - 3 tests pass

- [ ] **Step 5: Update pipeline-buttons to show subreddit names**

Replace the full contents of `src/components/pipeline-buttons.tsx`:

```typescript
'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { useRouter } from 'next/navigation'

export function PipelineButtons() {
  const router = useRouter()
  const [fetchLoading, setFetchLoading] = useState(false)
  const [analyzeLoading, setAnalyzeLoading] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  async function handleFetch() {
    setFetchLoading(true)
    setMessage(null)
    try {
      const res = await fetch('/api/fetch-posts', { method: 'POST' })
      const data = await res.json()
      if (data.subreddits?.length > 0) {
        setMessage(`Fetched ${data.fetched} posts from ${data.subreddits.join(', ')}`)
      } else {
        setMessage('No subreddits due for fetching')
      }
      router.refresh()
    } catch {
      setMessage('Failed to fetch posts')
    } finally {
      setFetchLoading(false)
    }
  }

  async function handleAnalyze() {
    setAnalyzeLoading(true)
    setMessage(null)
    try {
      const res = await fetch('/api/analyze', { method: 'POST' })
      const data = await res.json()
      setMessage(`Analyzed ${data.analyzed} posts`)
      router.refresh()
    } catch {
      setMessage('Failed to analyze posts')
    } finally {
      setAnalyzeLoading(false)
    }
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <div className="flex gap-2">
        <Button onClick={handleFetch} disabled={fetchLoading} variant="outline" size="sm">
          {fetchLoading ? 'Fetching…' : 'Refresh Reddit'}
        </Button>
        <Button onClick={handleAnalyze} disabled={analyzeLoading} size="sm">
          {analyzeLoading ? 'Analyzing…' : 'Analyze Posts'}
        </Button>
      </div>
      {message && <p className="text-xs text-gray-500">{message}</p>}
    </div>
  )
}
```

- [ ] **Step 6: Run full test suite**

```bash
npm test
```

Expected: All suites pass.

- [ ] **Step 7: Commit**

```bash
git add src/app/api/fetch-posts/route.ts src/app/api/__tests__/fetch-posts.test.ts src/components/pipeline-buttons.tsx
git commit -m "feat: fetch-posts uses fetchDueSubredditPosts, shows subreddit names in feedback"
```

---

## Task 7: Client Components for Settings Page

**Files:**
- Create: `src/components/subreddit-toggle.tsx`
- Create: `src/components/interval-select.tsx`
- Create: `src/components/add-subreddit-form.tsx`
- Create: `src/components/delete-subreddit-button.tsx`
- Create: `src/components/csv-import-button.tsx`

- [ ] **Step 1: Create SubredditToggle**

Create `src/components/subreddit-toggle.tsx`:

```typescript
'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export function SubredditToggle({ id, enabled }: { id: string; enabled: boolean }) {
  const router = useRouter()
  const [value, setValue] = useState(enabled)
  const [loading, setLoading] = useState(false)

  async function toggle() {
    setLoading(true)
    const next = !value
    setValue(next)
    try {
      await fetch(`/api/subreddits/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled: next }),
      })
      router.refresh()
    } catch {
      setValue(!next) // revert on error
    } finally {
      setLoading(false)
    }
  }

  return (
    <button
      onClick={toggle}
      disabled={loading}
      className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
        value ? 'bg-gray-900' : 'bg-gray-200'
      } ${loading ? 'opacity-50' : ''}`}
      aria-label={value ? 'Disable' : 'Enable'}
    >
      <span
        className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${
          value ? 'translate-x-4' : 'translate-x-1'
        }`}
      />
    </button>
  )
}
```

- [ ] **Step 2: Create IntervalSelect**

Create `src/components/interval-select.tsx`:

```typescript
'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

type Interval = 'HOURLY' | 'DAILY' | 'WEEKLY'

const LABELS: Record<Interval, string> = {
  HOURLY: 'Hourly',
  DAILY: 'Daily',
  WEEKLY: 'Weekly',
}

export function IntervalSelect({ id, value }: { id: string; value: string }) {
  const router = useRouter()
  const [current, setCurrent] = useState(value as Interval)

  async function onChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const next = e.target.value as Interval
    setCurrent(next)
    await fetch(`/api/subreddits/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fetchInterval: next }),
    })
    router.refresh()
  }

  return (
    <select
      value={current}
      onChange={onChange}
      className="text-sm border rounded px-2 py-1 bg-white text-gray-700 focus:outline-none focus:ring-1 focus:ring-gray-400"
    >
      {(Object.keys(LABELS) as Interval[]).map(k => (
        <option key={k} value={k}>{LABELS[k]}</option>
      ))}
    </select>
  )
}
```

- [ ] **Step 3: Create AddSubredditForm**

Create `src/components/add-subreddit-form.tsx`:

```typescript
'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

export function AddSubredditForm() {
  const router = useRouter()
  const [name, setName] = useState('')
  const [interval, setInterval] = useState('DAILY')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleAdd() {
    if (!name.trim()) return
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/subreddits', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim(), fetchInterval: interval }),
      })
      if (!res.ok) {
        const data = await res.json()
        setError(data.error ?? 'Failed to add subreddit')
        return
      }
      setName('')
      router.refresh()
    } catch {
      setError('Network error')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex gap-2 items-center flex-wrap">
      <Input
        value={name}
        onChange={e => setName(e.target.value)}
        placeholder="startups or r/startups"
        className="w-48 text-sm h-8"
        onKeyDown={e => e.key === 'Enter' && handleAdd()}
      />
      <select
        value={interval}
        onChange={e => setInterval(e.target.value)}
        className="text-sm border rounded px-2 py-1 bg-white text-gray-700 h-8 focus:outline-none"
      >
        <option value="HOURLY">Hourly</option>
        <option value="DAILY">Daily</option>
        <option value="WEEKLY">Weekly</option>
      </select>
      <Button onClick={handleAdd} disabled={loading || !name.trim()} size="sm" className="h-8">
        {loading ? 'Adding…' : 'Add'}
      </Button>
      {error && <span className="text-xs text-red-500">{error}</span>}
    </div>
  )
}
```

- [ ] **Step 4: Create DeleteSubredditButton**

Create `src/components/delete-subreddit-button.tsx`:

```typescript
'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export function DeleteSubredditButton({ id, name }: { id: string; name: string }) {
  const router = useRouter()
  const [confirming, setConfirming] = useState(false)
  const [loading, setLoading] = useState(false)

  async function handleDelete() {
    setLoading(true)
    try {
      await fetch(`/api/subreddits/${id}`, { method: 'DELETE' })
      router.refresh()
    } finally {
      setLoading(false)
      setConfirming(false)
    }
  }

  if (confirming) {
    return (
      <span className="flex gap-1 items-center">
        <span className="text-xs text-gray-500">Remove r/{name}?</span>
        <button
          onClick={handleDelete}
          disabled={loading}
          className="text-xs text-red-600 hover:underline disabled:opacity-50"
        >
          {loading ? 'Removing…' : 'Yes'}
        </button>
        <button
          onClick={() => setConfirming(false)}
          className="text-xs text-gray-400 hover:underline"
        >
          No
        </button>
      </span>
    )
  }

  return (
    <button
      onClick={() => setConfirming(true)}
      className="text-xs text-gray-400 hover:text-red-500 transition-colors"
    >
      Remove
    </button>
  )
}
```

- [ ] **Step 5: Create CsvImportButton**

Create `src/components/csv-import-button.tsx`:

```typescript
'use client'

import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'

export function CsvImportButton() {
  const router = useRouter()
  const inputRef = useRef<HTMLInputElement>(null)
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<string | null>(null)

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setLoading(true)
    setResult(null)
    try {
      const text = await file.text()
      const res = await fetch('/api/subreddits/import', {
        method: 'POST',
        headers: { 'Content-Type': 'text/csv' },
        body: text,
      })
      const data = await res.json()
      if (res.ok) {
        setResult(`${data.added} added, ${data.skipped} skipped`)
        router.refresh()
      } else {
        setResult(data.error ?? 'Import failed')
      }
    } catch {
      setResult('Network error during import')
    } finally {
      setLoading(false)
      if (inputRef.current) inputRef.current.value = ''
    }
  }

  return (
    <div className="flex gap-2 items-center">
      <input
        ref={inputRef}
        type="file"
        accept=".csv"
        onChange={handleFile}
        className="hidden"
        id="csv-import-input"
      />
      <Button
        variant="outline"
        size="sm"
        onClick={() => inputRef.current?.click()}
        disabled={loading}
        asChild={false}
      >
        {loading ? 'Importing…' : 'Import CSV'}
      </Button>
      {result && <span className="text-xs text-gray-500">{result}</span>}
    </div>
  )
}
```

- [ ] **Step 6: Verify TypeScript**

```bash
npx tsc --noEmit
```

Expected: zero errors.

- [ ] **Step 7: Commit**

```bash
git add src/components/subreddit-toggle.tsx src/components/interval-select.tsx src/components/add-subreddit-form.tsx src/components/delete-subreddit-button.tsx src/components/csv-import-button.tsx
git commit -m "feat: client components for subreddit settings (toggle, interval, add, delete, csv)"
```

---

## Task 8: Settings Page + Layout Nav Link

**Files:**
- Create: `src/app/settings/subreddits/page.tsx`
- Modify: `src/app/layout.tsx`

- [ ] **Step 1: Create the settings page**

Create `src/app/settings/subreddits/page.tsx`:

```typescript
import { prisma } from '@/lib/db'
import { SubredditToggle } from '@/components/subreddit-toggle'
import { IntervalSelect } from '@/components/interval-select'
import { AddSubredditForm } from '@/components/add-subreddit-form'
import { DeleteSubredditButton } from '@/components/delete-subreddit-button'
import { CsvImportButton } from '@/components/csv-import-button'

function formatRelative(date: Date): string {
  const diff = Date.now() - date.getTime()
  const h = Math.floor(diff / 3600000)
  if (h < 1) return 'just now'
  if (h < 24) return `${h}h ago`
  const d = Math.floor(h / 24)
  return `${d}d ago`
}

export default async function SubredditsSettingsPage() {
  const subreddits = await prisma.subreddit.findMany({ orderBy: { name: 'asc' } })

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Subreddits</h1>
        <p className="text-sm text-gray-500 mt-0.5">
          {subreddits.length} subreddits · manage which are monitored and how often
        </p>
      </div>

      <div className="bg-white border rounded-lg mb-6 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-gray-50 text-xs text-gray-500 uppercase tracking-wide">
              <th className="px-4 py-2.5 text-left">Subreddit</th>
              <th className="px-4 py-2.5 text-left">Enabled</th>
              <th className="px-4 py-2.5 text-left">Interval</th>
              <th className="px-4 py-2.5 text-left">Last Fetched</th>
              <th className="px-4 py-2.5"></th>
            </tr>
          </thead>
          <tbody>
            {subreddits.map(sub => (
              <tr key={sub.id} className="border-b last:border-0 hover:bg-gray-50">
                <td className="px-4 py-3 font-mono text-gray-800">r/{sub.name}</td>
                <td className="px-4 py-3">
                  <SubredditToggle id={sub.id} enabled={sub.enabled} />
                </td>
                <td className="px-4 py-3">
                  <IntervalSelect id={sub.id} value={sub.fetchInterval} />
                </td>
                <td className="px-4 py-3 text-gray-400 text-xs">
                  {sub.lastFetchedAt ? formatRelative(sub.lastFetchedAt) : 'never'}
                </td>
                <td className="px-4 py-3 text-right">
                  <DeleteSubredditButton id={sub.id} name={sub.name} />
                </td>
              </tr>
            ))}
            {subreddits.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-gray-400 text-sm">
                  No subreddits yet - add one below
                </td>
              </tr>
            )}
          </tbody>
        </table>
        <div className="px-4 py-3 border-t bg-gray-50">
          <AddSubredditForm />
        </div>
      </div>

      <div className="bg-white border rounded-lg p-4">
        <h2 className="font-medium text-sm mb-3">CSV</h2>
        <div className="flex gap-3 items-center flex-wrap">
          <a
            href="/api/subreddits/export"
            download="subreddits.csv"
            className="text-sm px-3 py-1.5 border rounded hover:border-gray-400 transition-colors"
          >
            Export CSV
          </a>
          <CsvImportButton />
        </div>
        <p className="text-xs text-gray-400 mt-2">
          CSV format: <code>name,enabled,fetchInterval</code> - import adds new subreddits only, never overwrites existing settings
        </p>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Add Settings nav link to layout**

Edit `src/app/layout.tsx` - replace the `<header>` content:

```typescript
import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import Link from 'next/link'
import './globals.css'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'RedditRadar',
  description: 'High-signal engineering lead discovery',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={`${inter.className} bg-gray-50 min-h-screen`}>
        <header className="border-b bg-white px-6 py-3 flex items-center gap-4">
          <Link href="/dashboard" className="font-bold text-lg tracking-tight hover:opacity-80">
            RedditRadar
          </Link>
          <span className="text-xs text-gray-400 mt-0.5">lead discovery for engineers</span>
          <nav className="ml-auto flex gap-4">
            <Link href="/dashboard" className="text-sm text-gray-600 hover:text-gray-900">
              Dashboard
            </Link>
            <Link href="/settings/subreddits" className="text-sm text-gray-600 hover:text-gray-900">
              Settings
            </Link>
          </nav>
        </header>
        <main className="max-w-5xl mx-auto px-4 py-8">{children}</main>
      </body>
    </html>
  )
}
```

- [ ] **Step 3: Verify TypeScript**

```bash
npx tsc --noEmit
```

Expected: zero errors.

- [ ] **Step 4: Commit**

```bash
git add src/app/settings/ src/app/layout.tsx
git commit -m "feat: settings page /settings/subreddits and nav link"
```

---

## Task 9: Final Verification

**Files:** None (verification only)

- [ ] **Step 1: Run full test suite**

```bash
npm test
```

Expected: All suites pass. The test count should be higher than before (new subreddit tests added).

- [ ] **Step 2: TypeScript check**

```bash
npx tsc --noEmit
```

Expected: zero errors.

- [ ] **Step 3: Start dev server and verify settings page**

```bash
npm run dev &
sleep 6
curl -s http://localhost:3000/settings/subreddits | grep -o 'RedditRadar\|Settings\|Subreddits' | head -5
kill %1 2>/dev/null || pkill -f "next dev" 2>/dev/null || true
```

Expected: output contains "RedditRadar", "Settings", "Subreddits"

- [ ] **Step 4: Final commit if any uncommitted changes**

```bash
git status
```

---

## Self-Review

**Spec coverage:**

| Spec requirement | Task |
|---|---|
| Subreddit DB table (name, enabled, fetchInterval, lastFetchedAt) | Task 1 |
| FetchInterval enum (HOURLY, DAILY, WEEKLY) | Task 1 |
| Seed 8 default subreddits | Task 1 |
| fetchDueSubredditPosts replaces fetchAllSubredditPosts | Task 2 |
| Interval-based due check (null = always due) | Task 2 |
| Update lastFetchedAt after successful fetch | Task 2 |
| GET /api/subreddits | Task 3 |
| POST /api/subreddits (validate, normalize, 400/409) | Task 3 |
| PATCH /api/subreddits/[id] (enabled, fetchInterval, 400/404) | Task 4 |
| DELETE /api/subreddits/[id] (404 handling) | Task 4 |
| GET /api/subreddits/export (CSV download) | Task 5 |
| POST /api/subreddits/import (merge, strip r/, skip invalid) | Task 5 |
| fetch-posts uses fetchDueSubredditPosts, returns subreddits[] | Task 6 |
| PipelineButtons shows subreddit names | Task 6 |
| SubredditToggle (inline PATCH on toggle) | Task 7 |
| IntervalSelect (inline PATCH on change) | Task 7 |
| AddSubredditForm (POST, error display) | Task 7 |
| DeleteSubredditButton (confirm then DELETE) | Task 7 |
| CsvImportButton (file picker, POST text/csv) | Task 7 |
| Settings page at /settings/subreddits | Task 8 |
| Settings nav link in layout | Task 8 |

**No gaps found.**

**Type consistency:**
- `FetchInterval` defined in Task 1 (`src/types/index.ts`) - used in Task 2 (`reddit.ts`) and Task 4 (`interval-select.tsx`)
- `fetchDueSubredditPosts(): Promise<{ posts: RedditPost[], subreddits: string[] }>` - defined in Task 2, consumed in Task 6
- `prisma.subreddit.update({ where: { id }, data: { lastFetchedAt: new Date() } })` - consistent across Task 2 and Task 4
- PATCH params type `{ params: Promise<{ id: string }> }` - consistent with existing routes in codebase
