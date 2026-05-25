# RedditRadar MVP Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a full-stack Next.js app that monitors Reddit for high-signal engineering hiring posts, scores them with AI against a developer profile, and generates personalized outreach messages.

**Architecture:** Next.js 14 App Router project with server components for the dashboard, API routes for data ingestion and AI analysis, Prisma ORM for PostgreSQL, and OpenAI (gpt-4o) for lead scoring and message generation. Reddit posts are fetched via public `.json` endpoints (no API key required for MVP), stored locally, and analyzed on demand. The UI is shadcn/ui + TailwindCSS.

**Tech Stack:** Next.js 14, TypeScript, TailwindCSS, shadcn/ui, Prisma, PostgreSQL 16, OpenAI SDK, Jest + ts-jest

---

## Scope Note

This plan covers five tightly-coupled subsystems in one app:
1. Reddit data ingestion
2. AI analysis pipeline
3. Lead management
4. Outreach generation
5. Dashboard UI

Each task produces working, independently testable software. The pipeline builds bottom-up: data layer → analysis → API → UI.

---

## File Map

```
/var/www/RedditRadar/
├── prisma/
│   └── schema.prisma                        # DB schema: Post, ExtractedSignal, Lead, GeneratedMessage
├── src/
│   ├── app/
│   │   ├── layout.tsx                       # Root layout with nav
│   │   ├── page.tsx                         # Redirect to /dashboard
│   │   ├── dashboard/
│   │   │   └── page.tsx                     # Lead list with filter/sort
│   │   └── leads/
│   │       └── [id]/
│   │           └── page.tsx                 # Lead detail + outreach panel
│   ├── app/api/
│   │   ├── fetch-posts/route.ts             # POST: pull Reddit posts, store new ones
│   │   ├── analyze/route.ts                 # POST: run AI on unanalyzed posts
│   │   ├── posts/route.ts                   # GET: list posts with signals
│   │   ├── leads/route.ts                   # GET list / POST create lead
│   │   ├── leads/[id]/route.ts              # GET detail / PATCH update status+notes
│   │   └── generate-message/route.ts        # POST: generate outreach message for lead
│   ├── lib/
│   │   ├── db.ts                            # Prisma client singleton
│   │   ├── reddit.ts                        # Fetch subreddit posts via JSON API
│   │   ├── openai.ts                        # Analyze post text → AnalysisResult
│   │   └── outreach.ts                      # Generate outreach message text
│   ├── components/
│   │   ├── lead-card.tsx                    # Single lead row/card in dashboard list
│   │   ├── score-badge.tsx                  # Colored badge: 0-100 match score
│   │   ├── status-badge.tsx                 # Colored badge: new/contacted/replied/archived
│   │   └── outreach-panel.tsx               # Outreach type selector + generated message
│   └── types/
│       └── index.ts                         # Shared TypeScript interfaces
├── src/lib/__tests__/
│   ├── reddit.test.ts
│   ├── openai.test.ts
│   └── outreach.test.ts
├── src/app/api/__tests__/
│   ├── fetch-posts.test.ts
│   ├── analyze.test.ts
│   └── leads.test.ts
├── jest.config.ts
├── jest.setup.ts
├── .env.local                               # OPENAI_API_KEY, DATABASE_URL
└── next.config.ts
```

---

## Task 1: Project Bootstrap

**Files:**
- Create: `package.json` (via npx)
- Create: `jest.config.ts`
- Create: `jest.setup.ts`
- Create: `.env.local`

- [ ] **Step 1: Scaffold Next.js project**

```bash
cd /var/www/RedditRadar
npx create-next-app@latest . \
  --typescript \
  --tailwind \
  --eslint \
  --app \
  --src-dir \
  --import-alias "@/*" \
  --no-git
```

Expected: project files created, `npm run dev` works.

- [ ] **Step 2: Install dependencies**

```bash
npm install prisma @prisma/client openai
npm install -D jest @types/jest ts-jest jest-environment-node
npx prisma init --datasource-provider postgresql
```

- [ ] **Step 3: Install shadcn/ui**

```bash
npx shadcn@latest init --defaults
npx shadcn@latest add button card badge input textarea select separator skeleton
```

Expected: `src/components/ui/` populated.

- [ ] **Step 4: Configure Jest**

Create `jest.config.ts`:

```typescript
import type { Config } from 'jest'
import nextJest from 'next/jest.js'

const createJestConfig = nextJest({ dir: './' })

const config: Config = {
  testEnvironment: 'node',
  setupFilesAfterFramework: ['<rootDir>/jest.setup.ts'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
  },
  testPathPattern: [
    'src/lib/__tests__',
    'src/app/api/__tests__',
  ],
}

export default createJestConfig(config)
```

Create `jest.setup.ts`:

```typescript
// Silence console.error in tests unless debugging
jest.spyOn(console, 'error').mockImplementation(() => {})
```

- [ ] **Step 5: Create .env.local**

```bash
cat > .env.local << 'EOF'
DATABASE_URL="postgresql://ravi@localhost:5432/redditradar"
OPENAI_API_KEY="sk-your-key-here"
EOF
```

- [ ] **Step 6: Create the database**

```bash
createdb redditradar
```

- [ ] **Step 7: Verify tests run**

```bash
npm test -- --passWithNoTests
```

Expected: `Test Suites: 0 passed` (no tests yet, no failures).

- [ ] **Step 8: Commit**

```bash
git init
git add -A
git commit -m "feat: bootstrap Next.js 14 + Prisma + shadcn/ui + Jest"
```

---

## Task 2: Database Schema & Migration

**Files:**
- Modify: `prisma/schema.prisma`

- [ ] **Step 1: Write the schema**

Replace the contents of `prisma/schema.prisma`:

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

model Post {
  id          String   @id @default(cuid())
  redditId    String   @unique
  subreddit   String
  title       String
  body        String
  author      String
  url         String
  postedAt    DateTime
  score       Int
  numComments Int
  fetchedAt   DateTime @default(now())

  signal  ExtractedSignal?
  lead    Lead?
}

model ExtractedSignal {
  id           String   @id @default(cuid())
  postId       String   @unique
  post         Post     @relation(fields: [postId], references: [id], onDelete: Cascade)
  technologies String[]
  painPoints   String[]
  seniority    String
  remote       Boolean
  startupStage String
  matchScore   Int
  summary      String
  analyzedAt   DateTime @default(now())
}

model Lead {
  id          String    @id @default(cuid())
  postId      String    @unique
  post        Post      @relation(fields: [postId], references: [id], onDelete: Cascade)
  status      LeadStatus @default(NEW)
  contactedAt DateTime?
  notes       String?
  createdAt   DateTime  @default(now())
  updatedAt   DateTime  @updatedAt

  messages GeneratedMessage[]
}

enum LeadStatus {
  NEW
  CONTACTED
  REPLIED
  ARCHIVED
}

model GeneratedMessage {
  id        String      @id @default(cuid())
  leadId    String
  lead      Lead        @relation(fields: [leadId], references: [id], onDelete: Cascade)
  type      MessageType
  content   String
  createdAt DateTime    @default(now())
}

enum MessageType {
  REDDIT_DM
  EMAIL
  LINKEDIN
}
```

- [ ] **Step 2: Run migration**

```bash
npx prisma migrate dev --name init
```

Expected: Migration applied, `prisma/migrations/` folder created.

- [ ] **Step 3: Verify schema with Prisma Studio**

```bash
npx prisma studio &
```

Open `http://localhost:5555`, confirm four tables exist. Kill the process after checking.

- [ ] **Step 4: Generate Prisma client**

```bash
npx prisma generate
```

Expected: `node_modules/@prisma/client` updated.

- [ ] **Step 5: Commit**

```bash
git add prisma/
git commit -m "feat: add Prisma schema for posts, signals, leads, messages"
```

---

## Task 3: Shared Types + DB Client

**Files:**
- Create: `src/types/index.ts`
- Create: `src/lib/db.ts`

- [ ] **Step 1: Write shared types**

Create `src/types/index.ts`:

```typescript
export type LeadStatus = 'NEW' | 'CONTACTED' | 'REPLIED' | 'ARCHIVED'
export type MessageType = 'REDDIT_DM' | 'EMAIL' | 'LINKEDIN'

export interface RedditPost {
  id: string          // Reddit's own ID (e.g. "t3_abc123")
  subreddit: string
  title: string
  selftext: string
  author: string
  url: string
  created_utc: number // Unix timestamp
  score: number
  num_comments: number
}

export interface AnalysisResult {
  technologies: string[]
  painPoints: string[]
  seniority: string
  remote: boolean
  startupStage: string
  matchScore: number  // 0-100
  summary: string
}
```

- [ ] **Step 2: Write the Prisma singleton**

Create `src/lib/db.ts`:

```typescript
import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient }

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({ log: process.env.NODE_ENV === 'development' ? ['error'] : [] })

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma
```

- [ ] **Step 3: Commit**

```bash
git add src/types/ src/lib/db.ts
git commit -m "feat: add shared types and Prisma singleton"
```

---

## Task 4: Reddit Fetcher (TDD)

**Files:**
- Create: `src/lib/reddit.ts`
- Create: `src/lib/__tests__/reddit.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `src/lib/__tests__/reddit.test.ts`:

```typescript
import { fetchSubredditPosts, fetchAllSubredditPosts, SUBREDDITS } from '@/lib/reddit'
import { RedditPost } from '@/types'

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
  return {
    data: {
      children: posts.map(p => ({ data: p })),
    },
  }
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
    expect(result[0].subreddit).toBe('startups')
  })

  it('throws when Reddit returns non-OK status', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 429,
    } as Response)

    await expect(fetchSubredditPosts('startups')).rejects.toThrow('Reddit API error: 429')
  })
})

describe('fetchAllSubredditPosts', () => {
  it('aggregates posts from all configured subreddits', async () => {
    global.fetch = jest.fn().mockImplementation((url: string) => {
      const sub = (url as string).match(/\/r\/(\w+)\//)?.[1] ?? 'unknown'
      return Promise.resolve({
        ok: true,
        json: async () => makeRedditResponse([mockPost('x', sub)]),
      })
    })

    const result = await fetchAllSubredditPosts()

    expect(result.length).toBe(SUBREDDITS.length)
  })

  it('skips subreddits that return errors', async () => {
    global.fetch = jest
      .fn()
      .mockResolvedValueOnce({ ok: false, status: 503 } as Response)
      .mockResolvedValue({
        ok: true,
        json: async () => makeRedditResponse([mockPost('y', 'startups')]),
      })

    const result = await fetchAllSubredditPosts()

    // One failed, rest succeeded
    expect(result.length).toBe(SUBREDDITS.length - 1)
  })
})
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
npm test -- src/lib/__tests__/reddit.test.ts
```

Expected: FAIL - `Cannot find module '@/lib/reddit'`

- [ ] **Step 3: Implement the fetcher**

Create `src/lib/reddit.ts`:

```typescript
import { RedditPost } from '@/types'

export const SUBREDDITS = [
  'forhire',
  'hiring',
  'startups',
  'SaaS',
  'webdev',
  'laravel',
  'golang',
  'remotework',
] as const

export async function fetchSubredditPosts(subreddit: string, limit = 25): Promise<RedditPost[]> {
  const res = await fetch(
    `https://www.reddit.com/r/${subreddit}/new.json?limit=${limit}`,
    { headers: { 'User-Agent': 'RedditRadar/1.0 (lead-discovery)' } }
  )

  if (!res.ok) throw new Error(`Reddit API error: ${res.status}`)

  const json = await res.json()
  return json.data.children.map((child: { data: RedditPost }) => child.data)
}

export async function fetchAllSubredditPosts(): Promise<RedditPost[]> {
  const results = await Promise.allSettled(
    SUBREDDITS.map(sub => fetchSubredditPosts(sub))
  )

  return results
    .filter((r): r is PromiseFulfilledResult<RedditPost[]> => r.status === 'fulfilled')
    .flatMap(r => r.value)
}
```

- [ ] **Step 4: Run tests to confirm they pass**

```bash
npm test -- src/lib/__tests__/reddit.test.ts
```

Expected: PASS - 4 tests pass

- [ ] **Step 5: Commit**

```bash
git add src/lib/reddit.ts src/lib/__tests__/reddit.test.ts
git commit -m "feat: Reddit JSON fetcher with multi-subreddit aggregation"
```

---

## Task 5: OpenAI Analysis Module (TDD)

**Files:**
- Create: `src/lib/openai.ts`
- Create: `src/lib/__tests__/openai.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `src/lib/__tests__/openai.test.ts`:

```typescript
import { analyzePost } from '@/lib/openai'
import { AnalysisResult } from '@/types'

jest.mock('openai')

const mockResult: AnalysisResult = {
  technologies: ['Laravel', 'PostgreSQL', 'Redis'],
  painPoints: ['slow queries', 'queue bottlenecks'],
  seniority: 'senior',
  remote: true,
  startupStage: 'growth',
  matchScore: 88,
  summary: 'Laravel SaaS startup needs backend scaling help.',
}

describe('analyzePost', () => {
  beforeEach(() => {
    const OpenAI = jest.requireMock('openai').default
    OpenAI.prototype.chat = {
      completions: {
        create: jest.fn().mockResolvedValue({
          choices: [{ message: { content: JSON.stringify(mockResult) } }],
        }),
      },
    }
  })

  it('returns parsed AnalysisResult for a post', async () => {
    const result = await analyzePost(
      'Backend engineer needed for SaaS startup',
      'We are struggling with Laravel queues and slow reporting'
    )

    expect(result.matchScore).toBe(88)
    expect(result.technologies).toContain('Laravel')
    expect(result.painPoints).toContain('slow queries')
    expect(result.remote).toBe(true)
  })

  it('sends both title and body in the user message', async () => {
    const OpenAI = jest.requireMock('openai').default
    const createSpy = OpenAI.prototype.chat.completions.create

    await analyzePost('My Title', 'My Body')

    const call = createSpy.mock.calls[0][0]
    const userMsg = call.messages.find((m: { role: string }) => m.role === 'user').content
    expect(userMsg).toContain('My Title')
    expect(userMsg).toContain('My Body')
  })

  it('uses json_object response format', async () => {
    const OpenAI = jest.requireMock('openai').default
    const createSpy = OpenAI.prototype.chat.completions.create

    await analyzePost('Title', 'Body')

    const call = createSpy.mock.calls[0][0]
    expect(call.response_format).toEqual({ type: 'json_object' })
  })
})
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
npm test -- src/lib/__tests__/openai.test.ts
```

Expected: FAIL - `Cannot find module '@/lib/openai'`

- [ ] **Step 3: Implement the analysis module**

Create `src/lib/openai.ts`:

```typescript
import OpenAI from 'openai'
import { AnalysisResult } from '@/types'

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

const ENGINEER_PROFILE = `
Backend engineer, 12+ years experience.
Core skills: Laravel, Go, PostgreSQL, Redis, API architecture, SaaS infrastructure, multi-tenant systems.
Seeking: freelance/contract, remote preferred.
Strong signal keywords: scaling, bottleneck, queue, multi-tenant, SaaS, backend, infrastructure, performance.
`

export async function analyzePost(title: string, body: string): Promise<AnalysisResult> {
  const response = await client.chat.completions.create({
    model: 'gpt-4o',
    response_format: { type: 'json_object' },
    messages: [
      {
        role: 'system',
        content: `You are a technical opportunity analyst. Given a Reddit post, analyze it for engineering job/contract opportunities.

Engineer profile:
${ENGINEER_PROFILE}

Return a JSON object with exactly these keys:
- technologies: string[] - detected tech stack mentioned
- painPoints: string[] - specific technical problems mentioned
- seniority: "junior" | "mid" | "senior" | "lead" | "unknown" - level sought
- remote: boolean - remote work mentioned or implied
- startupStage: "idea" | "early" | "growth" | "mature" | "unknown"
- matchScore: number 0-100 - fit with engineer profile (100 = perfect match)
- summary: string - one sentence describing the opportunity`,
      },
      {
        role: 'user',
        content: `Post title: ${title}\n\nPost body: ${body || '(no body text)'}`,
      },
    ],
  })

  const content = response.choices[0].message.content!
  return JSON.parse(content) as AnalysisResult
}
```

- [ ] **Step 4: Run tests to confirm they pass**

```bash
npm test -- src/lib/__tests__/openai.test.ts
```

Expected: PASS - 3 tests pass

- [ ] **Step 5: Commit**

```bash
git add src/lib/openai.ts src/lib/__tests__/openai.test.ts
git commit -m "feat: OpenAI post analysis with structured JSON output"
```

---

## Task 6: Outreach Generator (TDD)

**Files:**
- Create: `src/lib/outreach.ts`
- Create: `src/lib/__tests__/outreach.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `src/lib/__tests__/outreach.test.ts`:

```typescript
import { generateOutreachMessage } from '@/lib/outreach'
import { MessageType } from '@/types'

jest.mock('openai')

const mockSignal = {
  technologies: ['Laravel', 'Redis'],
  painPoints: ['queue bottlenecks', 'slow reporting'],
  startupStage: 'growth',
  summary: 'SaaS startup scaling backend.',
}

const mockPost = {
  title: 'Need backend help with queues',
  body: 'Our Laravel queues are backing up.',
  author: 'startup_alice',
  subreddit: 'startups',
}

describe('generateOutreachMessage', () => {
  beforeEach(() => {
    const OpenAI = jest.requireMock('openai').default
    OpenAI.prototype.chat = {
      completions: {
        create: jest.fn().mockResolvedValue({
          choices: [{ message: { content: 'Hey, saw your post about queue issues...' } }],
        }),
      },
    }
  })

  it('returns a string message', async () => {
    const msg = await generateOutreachMessage(mockPost, mockSignal, 'REDDIT_DM')
    expect(typeof msg).toBe('string')
    expect(msg.length).toBeGreaterThan(10)
  })

  it('includes message type in the system prompt', async () => {
    const OpenAI = jest.requireMock('openai').default
    const createSpy = OpenAI.prototype.chat.completions.create

    await generateOutreachMessage(mockPost, mockSignal, 'EMAIL')

    const call = createSpy.mock.calls[0][0]
    const systemMsg = call.messages.find((m: { role: string }) => m.role === 'system').content
    expect(systemMsg.toLowerCase()).toContain('email')
  })

  it('passes technologies and pain points to model', async () => {
    const OpenAI = jest.requireMock('openai').default
    const createSpy = OpenAI.prototype.chat.completions.create

    await generateOutreachMessage(mockPost, mockSignal, 'REDDIT_DM')

    const call = createSpy.mock.calls[0][0]
    const userMsg = call.messages.find((m: { role: string }) => m.role === 'user').content
    expect(userMsg).toContain('Laravel')
    expect(userMsg).toContain('queue bottlenecks')
  })
})
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
npm test -- src/lib/__tests__/outreach.test.ts
```

Expected: FAIL - `Cannot find module '@/lib/outreach'`

- [ ] **Step 3: Implement the outreach generator**

Create `src/lib/outreach.ts`:

```typescript
import OpenAI from 'openai'
import { MessageType } from '@/types'

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

const TONE_BY_TYPE: Record<MessageType, string> = {
  REDDIT_DM: 'a casual Reddit DM - short, developer-to-developer, no marketing fluff, 3-5 sentences max',
  EMAIL: 'a brief cold email - subject line on first line, 4-6 sentences, direct and respectful',
  LINKEDIN: 'a LinkedIn connection message - under 300 characters, direct value hook, no buzzwords',
}

interface PostContext {
  title: string
  body: string
  author: string
  subreddit: string
}

interface SignalContext {
  technologies: string[]
  painPoints: string[]
  startupStage: string
  summary: string
}

export async function generateOutreachMessage(
  post: PostContext,
  signal: SignalContext,
  type: MessageType
): Promise<string> {
  const response = await client.chat.completions.create({
    model: 'gpt-4o',
    messages: [
      {
        role: 'system',
        content: `You write outreach messages for a backend engineer reaching out to founders on Reddit.
        
Style: ${TONE_BY_TYPE[type]}
Voice: technical credibility, genuine interest, no recruiter-speak, no AI-spam tone.
Engineer background: 12 years backend (Laravel, Go, PostgreSQL, Redis, SaaS infrastructure).
Never: "I came across your post", "I would love to", "synergy", "leverage", corporate language.`,
      },
      {
        role: 'user',
        content: `Post: "${post.title}" by u/${post.author} in r/${post.subreddit}
Body excerpt: ${post.body.slice(0, 400)}

Detected signals:
- Technologies: ${signal.technologies.join(', ') || 'none'}
- Pain points: ${signal.painPoints.join(', ') || 'none'}
- Stage: ${signal.startupStage}
- Summary: ${signal.summary}

Write the ${type.replace('_', ' ').toLowerCase()} message now. Output only the message text.`,
      },
    ],
  })

  return response.choices[0].message.content!.trim()
}
```

- [ ] **Step 4: Run tests to confirm they pass**

```bash
npm test -- src/lib/__tests__/outreach.test.ts
```

Expected: PASS - 3 tests pass

- [ ] **Step 5: Commit**

```bash
git add src/lib/outreach.ts src/lib/__tests__/outreach.test.ts
git commit -m "feat: AI outreach message generator with Reddit DM, email, LinkedIn modes"
```

---

## Task 7: Post Ingestion API Route (TDD)

**Files:**
- Create: `src/app/api/fetch-posts/route.ts`
- Create: `src/app/api/__tests__/fetch-posts.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/app/api/__tests__/fetch-posts.test.ts`:

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

import { fetchAllSubredditPosts } from '@/lib/reddit'
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

  it('returns 200 with count of upserted posts', async () => {
    ;(fetchAllSubredditPosts as jest.Mock).mockResolvedValue([mockRedditPost])

    const req = new NextRequest('http://localhost/api/fetch-posts', { method: 'POST' })
    const res = await POST(req)
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.fetched).toBe(1)
  })

  it('calls prisma.post.upsert with correct shape', async () => {
    ;(fetchAllSubredditPosts as jest.Mock).mockResolvedValue([mockRedditPost])

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

  it('returns 500 when Reddit fetch fails', async () => {
    ;(fetchAllSubredditPosts as jest.Mock).mockRejectedValue(new Error('network error'))

    const req = new NextRequest('http://localhost/api/fetch-posts', { method: 'POST' })
    const res = await POST(req)

    expect(res.status).toBe(500)
  })
})
```

- [ ] **Step 2: Run test to confirm it fails**

```bash
npm test -- src/app/api/__tests__/fetch-posts.test.ts
```

Expected: FAIL - `Cannot find module '@/app/api/fetch-posts/route'`

- [ ] **Step 3: Implement the route**

Create `src/app/api/fetch-posts/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { fetchAllSubredditPosts } from '@/lib/reddit'
import { prisma } from '@/lib/db'

export async function POST(_req: NextRequest) {
  try {
    const posts = await fetchAllSubredditPosts()

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

    return NextResponse.json({ fetched: posts.length })
  } catch (err) {
    console.error('fetch-posts error:', err)
    return NextResponse.json({ error: 'Failed to fetch posts' }, { status: 500 })
  }
}
```

- [ ] **Step 4: Run tests to confirm they pass**

```bash
npm test -- src/app/api/__tests__/fetch-posts.test.ts
```

Expected: PASS - 3 tests pass

- [ ] **Step 5: Commit**

```bash
git add src/app/api/fetch-posts/ src/app/api/__tests__/fetch-posts.test.ts
git commit -m "feat: POST /api/fetch-posts - ingest Reddit posts via upsert"
```

---

## Task 8: Analysis Pipeline API Route (TDD)

**Files:**
- Create: `src/app/api/analyze/route.ts`
- Create: `src/app/api/__tests__/analyze.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/app/api/__tests__/analyze.test.ts`:

```typescript
import { POST } from '@/app/api/analyze/route'
import { NextRequest } from 'next/server'

jest.mock('@/lib/openai')
jest.mock('@/lib/db', () => ({
  prisma: {
    post: {
      findMany: jest.fn(),
    },
    extractedSignal: {
      create: jest.fn().mockResolvedValue({ id: 'sig1' }),
    },
  },
}))

import { analyzePost } from '@/lib/openai'
import { prisma } from '@/lib/db'

const mockAnalysisResult = {
  technologies: ['Laravel'],
  painPoints: ['slow queries'],
  seniority: 'senior',
  remote: true,
  startupStage: 'growth',
  matchScore: 75,
  summary: 'SaaS backend scaling opportunity.',
}

const mockPost = {
  id: 'post1',
  title: 'Need backend help',
  body: 'Our Laravel app is slow',
}

describe('POST /api/analyze', () => {
  beforeEach(() => jest.clearAllMocks())

  it('analyzes unanalyzed posts and returns count', async () => {
    ;(prisma.post.findMany as jest.Mock).mockResolvedValue([mockPost])
    ;(analyzePost as jest.Mock).mockResolvedValue(mockAnalysisResult)

    const req = new NextRequest('http://localhost/api/analyze', { method: 'POST' })
    const res = await POST(req)
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.analyzed).toBe(1)
  })

  it('creates ExtractedSignal with correct data', async () => {
    ;(prisma.post.findMany as jest.Mock).mockResolvedValue([mockPost])
    ;(analyzePost as jest.Mock).mockResolvedValue(mockAnalysisResult)

    const req = new NextRequest('http://localhost/api/analyze', { method: 'POST' })
    await POST(req)

    expect(prisma.extractedSignal.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        postId: 'post1',
        matchScore: 75,
        technologies: ['Laravel'],
        painPoints: ['slow queries'],
      }),
    })
  })

  it('returns 0 when no unanalyzed posts exist', async () => {
    ;(prisma.post.findMany as jest.Mock).mockResolvedValue([])

    const req = new NextRequest('http://localhost/api/analyze', { method: 'POST' })
    const res = await POST(req)
    const body = await res.json()

    expect(body.analyzed).toBe(0)
    expect(analyzePost).not.toHaveBeenCalled()
  })
})
```

- [ ] **Step 2: Run test to confirm it fails**

```bash
npm test -- src/app/api/__tests__/analyze.test.ts
```

Expected: FAIL - `Cannot find module '@/app/api/analyze/route'`

- [ ] **Step 3: Implement the route**

Create `src/app/api/analyze/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { analyzePost } from '@/lib/openai'
import { prisma } from '@/lib/db'

export async function POST(_req: NextRequest) {
  // Only fetch posts that have no ExtractedSignal yet
  const unanalyzed = await prisma.post.findMany({
    where: { signal: null },
    select: { id: true, title: true, body: true },
    take: 20, // batch limit to control OpenAI cost per call
  })

  let analyzed = 0
  for (const post of unanalyzed) {
    try {
      const result = await analyzePost(post.title, post.body)
      await prisma.extractedSignal.create({
        data: {
          postId: post.id,
          technologies: result.technologies,
          painPoints: result.painPoints,
          seniority: result.seniority,
          remote: result.remote,
          startupStage: result.startupStage,
          matchScore: result.matchScore,
          summary: result.summary,
        },
      })
      analyzed++
    } catch (err) {
      console.error(`Failed to analyze post ${post.id}:`, err)
    }
  }

  return NextResponse.json({ analyzed })
}
```

- [ ] **Step 4: Run tests to confirm they pass**

```bash
npm test -- src/app/api/__tests__/analyze.test.ts
```

Expected: PASS - 3 tests pass

- [ ] **Step 5: Commit**

```bash
git add src/app/api/analyze/ src/app/api/__tests__/analyze.test.ts
git commit -m "feat: POST /api/analyze - batch AI analysis for unprocessed posts"
```

---

## Task 9: Leads API Routes (TDD)

**Files:**
- Create: `src/app/api/leads/route.ts`
- Create: `src/app/api/leads/[id]/route.ts`
- Create: `src/app/api/__tests__/leads.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `src/app/api/__tests__/leads.test.ts`:

```typescript
import { GET, POST } from '@/app/api/leads/route'
import { GET as GET_DETAIL, PATCH } from '@/app/api/leads/[id]/route'
import { NextRequest } from 'next/server'

jest.mock('@/lib/db', () => ({
  prisma: {
    lead: {
      findMany: jest.fn(),
      create: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
    },
  },
}))

import { prisma } from '@/lib/db'

const mockLead = {
  id: 'lead1',
  postId: 'post1',
  status: 'NEW',
  notes: null,
  contactedAt: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  post: { title: 'Backend help needed', subreddit: 'startups', url: 'http://reddit.com/...' },
  signal: { matchScore: 80, technologies: ['Laravel'], painPoints: ['queues'], summary: 'Good match.' },
  messages: [],
}

describe('GET /api/leads', () => {
  it('returns leads list', async () => {
    ;(prisma.lead.findMany as jest.Mock).mockResolvedValue([mockLead])

    const req = new NextRequest('http://localhost/api/leads')
    const res = await GET(req)
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body).toHaveLength(1)
    expect(body[0].id).toBe('lead1')
  })
})

describe('POST /api/leads', () => {
  it('creates a lead for a post', async () => {
    ;(prisma.lead.create as jest.Mock).mockResolvedValue(mockLead)

    const req = new NextRequest('http://localhost/api/leads', {
      method: 'POST',
      body: JSON.stringify({ postId: 'post1' }),
      headers: { 'Content-Type': 'application/json' },
    })
    const res = await POST(req)

    expect(res.status).toBe(201)
    expect(prisma.lead.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: { postId: 'post1' } })
    )
  })

  it('returns 400 when postId is missing', async () => {
    const req = new NextRequest('http://localhost/api/leads', {
      method: 'POST',
      body: JSON.stringify({}),
      headers: { 'Content-Type': 'application/json' },
    })
    const res = await POST(req)

    expect(res.status).toBe(400)
  })
})

describe('PATCH /api/leads/[id]', () => {
  it('updates lead status and notes', async () => {
    ;(prisma.lead.update as jest.Mock).mockResolvedValue({ ...mockLead, status: 'CONTACTED' })

    const req = new NextRequest('http://localhost/api/leads/lead1', {
      method: 'PATCH',
      body: JSON.stringify({ status: 'CONTACTED', notes: 'Sent DM' }),
      headers: { 'Content-Type': 'application/json' },
    })
    const res = await PATCH(req, { params: { id: 'lead1' } })
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(prisma.lead.update).toHaveBeenCalledWith({
      where: { id: 'lead1' },
      data: expect.objectContaining({ status: 'CONTACTED', notes: 'Sent DM' }),
    })
  })
})
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
npm test -- src/app/api/__tests__/leads.test.ts
```

Expected: FAIL - modules not found

- [ ] **Step 3: Implement leads list + create route**

Create `src/app/api/leads/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

export async function GET(_req: NextRequest) {
  const leads = await prisma.lead.findMany({
    include: {
      post: { select: { title: true, subreddit: true, url: true, author: true } },
      signal: { select: { matchScore: true, technologies: true, painPoints: true, summary: true } },
      messages: { select: { id: true, type: true, createdAt: true } },
    },
    orderBy: [
      { signal: { matchScore: 'desc' } },
      { createdAt: 'desc' },
    ],
  })
  return NextResponse.json(leads)
}

export async function POST(req: NextRequest) {
  const body = await req.json()
  if (!body.postId) {
    return NextResponse.json({ error: 'postId is required' }, { status: 400 })
  }

  const lead = await prisma.lead.create({
    data: { postId: body.postId },
  })
  return NextResponse.json(lead, { status: 201 })
}
```

- [ ] **Step 4: Implement lead detail + update route**

Create `src/app/api/leads/[id]/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const lead = await prisma.lead.findUnique({
    where: { id: params.id },
    include: {
      post: true,
      signal: true,
      messages: { orderBy: { createdAt: 'desc' } },
    },
  })

  if (!lead) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json(lead)
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const body = await req.json()

  const data: Record<string, unknown> = {}
  if (body.status) {
    data.status = body.status
    if (body.status === 'CONTACTED') data.contactedAt = new Date()
  }
  if (body.notes !== undefined) data.notes = body.notes

  const lead = await prisma.lead.update({
    where: { id: params.id },
    data,
  })
  return NextResponse.json(lead)
}
```

- [ ] **Step 5: Run tests to confirm they pass**

```bash
npm test -- src/app/api/__tests__/leads.test.ts
```

Expected: PASS - 4 tests pass

- [ ] **Step 6: Commit**

```bash
git add src/app/api/leads/ src/app/api/__tests__/leads.test.ts
git commit -m "feat: leads CRUD API routes - list, create, update status/notes"
```

---

## Task 10: Generate Message API Route

**Files:**
- Create: `src/app/api/generate-message/route.ts`

- [ ] **Step 1: Implement the route**

Create `src/app/api/generate-message/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { generateOutreachMessage } from '@/lib/outreach'
import { prisma } from '@/lib/db'
import { MessageType } from '@/types'

const VALID_TYPES: MessageType[] = ['REDDIT_DM', 'EMAIL', 'LINKEDIN']

export async function POST(req: NextRequest) {
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
      post: true,
      signal: true,
    },
  })

  if (!lead || !lead.signal) {
    return NextResponse.json({ error: 'Lead not found or not yet analyzed' }, { status: 404 })
  }

  const content = await generateOutreachMessage(
    { title: lead.post.title, body: lead.post.body, author: lead.post.author, subreddit: lead.post.subreddit },
    { technologies: lead.signal.technologies, painPoints: lead.signal.painPoints, startupStage: lead.signal.startupStage, summary: lead.signal.summary },
    type as MessageType
  )

  const message = await prisma.generatedMessage.create({
    data: { leadId, type, content },
  })

  return NextResponse.json(message, { status: 201 })
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/api/generate-message/
git commit -m "feat: POST /api/generate-message - create and store outreach messages"
```

---

## Task 11: Score & Status Badge Components

**Files:**
- Create: `src/components/score-badge.tsx`
- Create: `src/components/status-badge.tsx`

- [ ] **Step 1: Implement ScoreBadge**

Create `src/components/score-badge.tsx`:

```typescript
import { Badge } from '@/components/ui/badge'

function scoreColor(score: number): string {
  if (score >= 80) return 'bg-green-100 text-green-800 border-green-200'
  if (score >= 60) return 'bg-yellow-100 text-yellow-800 border-yellow-200'
  if (score >= 40) return 'bg-orange-100 text-orange-800 border-orange-200'
  return 'bg-red-100 text-red-800 border-red-200'
}

export function ScoreBadge({ score }: { score: number }) {
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold border ${scoreColor(score)}`}>
      {score}%
    </span>
  )
}
```

- [ ] **Step 2: Implement StatusBadge**

Create `src/components/status-badge.tsx`:

```typescript
import { LeadStatus } from '@/types'

const STATUS_STYLES: Record<LeadStatus, string> = {
  NEW: 'bg-blue-100 text-blue-800 border-blue-200',
  CONTACTED: 'bg-purple-100 text-purple-800 border-purple-200',
  REPLIED: 'bg-green-100 text-green-800 border-green-200',
  ARCHIVED: 'bg-gray-100 text-gray-500 border-gray-200',
}

export function StatusBadge({ status }: { status: LeadStatus }) {
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border ${STATUS_STYLES[status]}`}>
      {status}
    </span>
  )
}
```

- [ ] **Step 3: Commit**

```bash
git add src/components/score-badge.tsx src/components/status-badge.tsx
git commit -m "feat: ScoreBadge and StatusBadge display components"
```

---

## Task 12: Dashboard UI

**Files:**
- Modify: `src/app/layout.tsx`
- Modify: `src/app/page.tsx`
- Create: `src/app/dashboard/page.tsx`

- [ ] **Step 1: Update root layout**

Replace `src/app/layout.tsx`:

```typescript
import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
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
        <header className="border-b bg-white px-6 py-3 flex items-center gap-3">
          <span className="font-bold text-lg tracking-tight">RedditRadar</span>
          <span className="text-xs text-gray-400 mt-0.5">lead discovery for engineers</span>
        </header>
        <main className="max-w-5xl mx-auto px-4 py-8">{children}</main>
      </body>
    </html>
  )
}
```

- [ ] **Step 2: Root page redirects to dashboard**

Replace `src/app/page.tsx`:

```typescript
import { redirect } from 'next/navigation'

export default function Home() {
  redirect('/dashboard')
}
```

- [ ] **Step 3: Build the dashboard**

Create `src/app/dashboard/page.tsx`:

```typescript
import Link from 'next/link'
import { prisma } from '@/lib/db'
import { ScoreBadge } from '@/components/score-badge'
import { StatusBadge } from '@/components/status-badge'
import { Button } from '@/components/ui/button'
import { LeadStatus } from '@/types'

async function getLeads(status?: string) {
  return prisma.lead.findMany({
    where: status ? { status: status as LeadStatus } : undefined,
    include: {
      post: { select: { title: true, subreddit: true, url: true, author: true, postedAt: true } },
      signal: { select: { matchScore: true, technologies: true, painPoints: true, summary: true } },
      messages: { select: { id: true } },
    },
    orderBy: [{ signal: { matchScore: 'desc' } }, { createdAt: 'desc' }],
    take: 50,
  })
}

async function getUnanalyzedCount() {
  return prisma.post.count({ where: { signal: null } })
}

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: { status?: string }
}) {
  const [leads, unanalyzed] = await Promise.all([
    getLeads(searchParams.status),
    getUnanalyzedCount(),
  ])

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Leads</h1>
          <p className="text-sm text-gray-500 mt-0.5">{leads.length} tracked · {unanalyzed} posts awaiting analysis</p>
        </div>
        <div className="flex gap-2">
          <form action="/api/fetch-posts" method="POST">
            <Button type="submit" variant="outline" size="sm">Refresh Reddit</Button>
          </form>
          <form action="/api/analyze" method="POST">
            <Button type="submit" size="sm">Analyze Posts</Button>
          </form>
        </div>
      </div>

      {/* Status filter */}
      <div className="flex gap-2 mb-4">
        {['', 'NEW', 'CONTACTED', 'REPLIED', 'ARCHIVED'].map(s => (
          <Link
            key={s}
            href={s ? `?status=${s}` : '/dashboard'}
            className={`px-3 py-1 rounded text-sm border ${
              (searchParams.status ?? '') === s
                ? 'bg-gray-900 text-white border-gray-900'
                : 'bg-white text-gray-600 border-gray-200 hover:border-gray-400'
            }`}
          >
            {s || 'All'}
          </Link>
        ))}
      </div>

      {leads.length === 0 && (
        <div className="text-center py-16 text-gray-400">
          <p className="text-lg font-medium">No leads yet</p>
          <p className="text-sm mt-1">Click "Refresh Reddit" then "Analyze Posts" to get started</p>
        </div>
      )}

      <div className="space-y-3">
        {leads.map(lead => (
          <Link
            key={lead.id}
            href={`/leads/${lead.id}`}
            className="block bg-white border rounded-lg px-5 py-4 hover:border-gray-400 transition-colors"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xs text-gray-400">r/{lead.post.subreddit}</span>
                  {lead.signal && <ScoreBadge score={lead.signal.matchScore} />}
                  <StatusBadge status={lead.status as LeadStatus} />
                  {lead.messages.length > 0 && (
                    <span className="text-xs text-gray-400">{lead.messages.length} msg</span>
                  )}
                </div>
                <p className="font-medium text-gray-900 truncate">{lead.post.title}</p>
                {lead.signal?.summary && (
                  <p className="text-sm text-gray-500 mt-0.5 truncate">{lead.signal.summary}</p>
                )}
                {lead.signal?.technologies && lead.signal.technologies.length > 0 && (
                  <div className="flex gap-1 mt-2 flex-wrap">
                    {lead.signal.technologies.slice(0, 5).map(t => (
                      <span key={t} className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded">
                        {t}
                      </span>
                    ))}
                  </div>
                )}
              </div>
              <span className="text-xs text-gray-400 whitespace-nowrap">
                {new Date(lead.post.postedAt).toLocaleDateString()}
              </span>
            </div>
          </Link>
        ))}
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Commit**

```bash
git add src/app/layout.tsx src/app/page.tsx src/app/dashboard/
git commit -m "feat: dashboard UI with lead list, score/status filters, and pipeline controls"
```

---

## Task 13: Lead Detail + Outreach UI

**Files:**
- Create: `src/app/leads/[id]/page.tsx`
- Create: `src/components/outreach-panel.tsx`

- [ ] **Step 1: Build the outreach panel (client component)**

Create `src/components/outreach-panel.tsx`:

```typescript
'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { MessageType } from '@/types'

interface Props {
  leadId: string
  existingMessages: Array<{ id: string; type: MessageType; content: string }>
}

export function OutreachPanel({ leadId, existingMessages }: Props) {
  const [type, setType] = useState<MessageType>('REDDIT_DM')
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(false)
  const [saved, setSaved] = useState(existingMessages)

  async function generate() {
    setLoading(true)
    try {
      const res = await fetch('/api/generate-message', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ leadId, type }),
      })
      const data = await res.json()
      setMessage(data.content)
      setSaved(prev => [data, ...prev])
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex gap-2 items-center">
        <Select value={type} onValueChange={v => setType(v as MessageType)}>
          <SelectTrigger className="w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="REDDIT_DM">Reddit DM</SelectItem>
            <SelectItem value="EMAIL">Email</SelectItem>
            <SelectItem value="LINKEDIN">LinkedIn</SelectItem>
          </SelectContent>
        </Select>
        <Button onClick={generate} disabled={loading} size="sm">
          {loading ? 'Generating…' : 'Generate'}
        </Button>
      </div>

      {message && (
        <div>
          <Textarea
            value={message}
            onChange={e => setMessage(e.target.value)}
            rows={8}
            className="font-mono text-sm"
          />
          <Button
            variant="outline"
            size="sm"
            className="mt-2"
            onClick={() => navigator.clipboard.writeText(message)}
          >
            Copy
          </Button>
        </div>
      )}

      {saved.length > 0 && (
        <div>
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">Previous Messages</p>
          <div className="space-y-2">
            {saved.map(m => (
              <div key={m.id} className="text-sm bg-gray-50 border rounded p-3">
                <span className="text-xs font-medium text-gray-400 block mb-1">{m.type}</span>
                <p className="whitespace-pre-wrap text-gray-700">{m.content}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Build the lead detail page**

Create `src/app/leads/[id]/page.tsx`:

```typescript
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { prisma } from '@/lib/db'
import { ScoreBadge } from '@/components/score-badge'
import { StatusBadge } from '@/components/status-badge'
import { OutreachPanel } from '@/components/outreach-panel'
import { LeadStatus, MessageType } from '@/types'

async function getLead(id: string) {
  return prisma.lead.findUnique({
    where: { id },
    include: {
      post: true,
      signal: true,
      messages: { orderBy: { createdAt: 'desc' } },
    },
  })
}

export default async function LeadDetailPage({ params }: { params: { id: string } }) {
  const lead = await getLead(params.id)
  if (!lead) notFound()

  return (
    <div>
      <Link href="/dashboard" className="text-sm text-gray-400 hover:text-gray-600 mb-4 inline-block">
        ← Dashboard
      </Link>

      <div className="bg-white border rounded-lg p-6 mb-6">
        <div className="flex items-center gap-2 mb-2">
          <span className="text-sm text-gray-400">r/{lead.post.subreddit}</span>
          {lead.signal && <ScoreBadge score={lead.signal.matchScore} />}
          <StatusBadge status={lead.status as LeadStatus} />
        </div>

        <h1 className="text-xl font-bold text-gray-900 mb-1">{lead.post.title}</h1>
        <p className="text-sm text-gray-500 mb-4">
          by u/{lead.post.author} · {new Date(lead.post.postedAt).toLocaleDateString()}
        </p>

        {lead.post.body && (
          <div className="text-sm text-gray-700 whitespace-pre-wrap bg-gray-50 rounded p-4 mb-4 max-h-48 overflow-y-auto">
            {lead.post.body}
          </div>
        )}

        <a
          href={lead.post.url}
          target="_blank"
          rel="noopener noreferrer"
          className="text-sm text-blue-600 hover:underline"
        >
          View on Reddit →
        </a>
      </div>

      {lead.signal && (
        <div className="bg-white border rounded-lg p-6 mb-6">
          <h2 className="font-semibold mb-3">AI Analysis</h2>
          <p className="text-sm text-gray-700 mb-3">{lead.signal.summary}</p>

          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-1">Technologies</p>
              <div className="flex flex-wrap gap-1">
                {lead.signal.technologies.map(t => (
                  <span key={t} className="bg-blue-50 text-blue-700 px-2 py-0.5 rounded text-xs">{t}</span>
                ))}
              </div>
            </div>
            <div>
              <p className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-1">Pain Points</p>
              <div className="flex flex-wrap gap-1">
                {lead.signal.painPoints.map(p => (
                  <span key={p} className="bg-orange-50 text-orange-700 px-2 py-0.5 rounded text-xs">{p}</span>
                ))}
              </div>
            </div>
            <div>
              <p className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-1">Remote</p>
              <p>{lead.signal.remote ? 'Yes' : 'No/Unknown'}</p>
            </div>
            <div>
              <p className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-1">Stage</p>
              <p className="capitalize">{lead.signal.startupStage}</p>
            </div>
          </div>
        </div>
      )}

      <div className="bg-white border rounded-lg p-6">
        <h2 className="font-semibold mb-4">Generate Outreach</h2>
        {lead.signal ? (
          <OutreachPanel
            leadId={lead.id}
            existingMessages={lead.messages.map(m => ({
              id: m.id,
              type: m.type as MessageType,
              content: m.content,
            }))}
          />
        ) : (
          <p className="text-sm text-gray-500">This post has not been analyzed yet. Run analysis from the dashboard.</p>
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Commit**

```bash
git add src/app/leads/ src/components/outreach-panel.tsx
git commit -m "feat: lead detail page with AI signal display and outreach generator UI"
```

---

## Task 14: Run All Tests + Manual Smoke Test

- [ ] **Step 1: Run the full test suite**

```bash
npm test
```

Expected: All suites pass. Fix any failures before proceeding.

- [ ] **Step 2: Start dev server**

```bash
npm run dev
```

Expected: Server starts on `http://localhost:3000`

- [ ] **Step 3: Manual smoke test - ingest posts**

```bash
curl -X POST http://localhost:3000/api/fetch-posts
```

Expected: `{"fetched": <number>}` - should be > 0.

- [ ] **Step 4: Manual smoke test - analyze posts**

```bash
curl -X POST http://localhost:3000/api/analyze
```

Expected: `{"analyzed": <number>}` - posts scored.
Note: This calls OpenAI. Ensure `OPENAI_API_KEY` is set in `.env.local`.

- [ ] **Step 5: Manual smoke test - create a lead**

```bash
# Get a post ID from the DB
FIRST_POST=$(psql redditradar -t -c "SELECT id FROM \"Post\" LIMIT 1;" | tr -d ' ')
curl -X POST http://localhost:3000/api/leads \
  -H 'Content-Type: application/json' \
  -d "{\"postId\": \"$FIRST_POST\"}"
```

Expected: `{"id": "...", "status": "NEW", ...}`

- [ ] **Step 6: Open dashboard in browser**

Open `http://localhost:3000` - should redirect to `/dashboard` and show leads.

- [ ] **Step 7: Final commit**

```bash
git add -A
git commit -m "feat: RedditRadar MVP complete - Reddit ingestion, AI scoring, lead tracking, outreach generator"
```

---

## Self-Review

**Spec coverage check:**

| Feature | Task |
|---|---|
| Reddit Hiring Feed (monitor subreddits) | Task 4, 7 |
| AI Relevance Scoring | Task 5, 8 |
| Founder Pain Detection | Task 5 (painPoints field) |
| Outreach Generator (Reddit DM, email, LinkedIn) | Task 6, 10 |
| Lead Tracking (status, notes, messages) | Task 9 |
| Dashboard UI | Task 12 |
| Lead Detail UI | Task 13 |
| DB schema (posts, signals, leads, messages) | Task 2 |
| Example subreddits from README | Task 4 (SUBREDDITS constant) |

**No gaps found.** All README features have a corresponding task.

**Type consistency:**
- `AnalysisResult` defined in Task 3 (`src/types/index.ts`), used in Tasks 5, 8
- `RedditPost` defined in Task 3, used in Task 4
- `LeadStatus` and `MessageType` defined in Task 3, used throughout
- `analyzePost(title, body)` signature consistent in Task 5 and Task 8
- `generateOutreachMessage(post, signal, type)` signature consistent in Task 6 and Task 10
- Prisma field names (`matchScore`, `painPoints`, etc.) match schema from Task 2

**No placeholders found.** All steps include complete code.
