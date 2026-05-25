<picture>
  <source media="(prefers-color-scheme: dark)" srcset="https://socialify.git.ci/anomalyco/redditradar/image?description=1&font=Inter&language=1&name=1&owner=1&pattern=Solid&theme=Dark" />
  <img alt="RedditRadar" src="https://socialify.git.ci/anomalyco/redditradar/image?description=1&font=Inter&language=1&name=1&owner=1&pattern=Solid&theme=Light" />
</picture>

**RedditRadar** is an open-source lead discovery tool for engineers. It monitors subreddits, fetches posts, analyzes them with AI against your custom engineer profile, and helps you track and reach out to promising opportunities — all from a self-hosted dashboard.

Built with [Next.js](https://nextjs.org) 16, [Prisma](https://prisma.io) 7, PostgreSQL, and [Tailwind CSS](https://tailwindcss.com).

---

## Features

- **Subreddit Manager** — Add, remove, enable/disable subreddits; configure per-subreddit fetch intervals (hourly/daily/weekly)
- **Smart Fetching** — Fetches posts from Reddit's JSON API with configurable max post age, keyword filtering, and rate-limit-aware pacing (1.5s pause between subreddits)
- **AI Analysis** — Analyzes posts using OpenAI, OpenRouter, or Groq against your custom engineer profile. Extracts technologies, pain points, seniority level, remote suitability, and match score
- **Lead Pipeline** — Track promising leads through NEW → CONTACTED → REPLIED → ARCHIVED stages; generate outreach messages (Reddit DM, Email, LinkedIn) via AI
- **CSV Import/Export** — Bulk manage your subreddit list
- **Settings Hub** — Configure subreddits, filter keywords, engineer profile, AI provider/model, and fetch age limits
- **Post Browser** — Search and filter all imported posts by keyword, subreddit, analysis status, match score, and lead status

---

## Prerequisites

- **Node.js** 20+
- **PostgreSQL** 14+
- An API key from one of: [OpenAI](https://platform.openai.com), [OpenRouter](https://openrouter.ai), or [Groq](https://groq.com)

---

## Quick Start

### 1. Clone and install

```bash
git clone https://github.com/anomalyco/redditradar.git
cd redditradar
npm install
```

### 2. Set up the database

Create a PostgreSQL database and configure the connection:

```bash
cp .env.example .env.local
# Edit DATABASE_URL in .env.local
```

```env
DATABASE_URL="postgresql://user:password@localhost:5432/redditradar?schema=public"
```

Run the migration and seed:

```bash
npx prisma migrate dev
npx prisma db seed
```

### 3. Add API keys

Add at least one AI provider key to `.env.local`:

```env
# Required for analysis and outreach
OPENAI_API_KEY="sk-..."
# or
OPENROUTER_API_KEY="sk-..."
# or
GROQ_API_KEY="gsk-..."
```

### 4. Start the dev server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). The dashboard will guide you through your first fetch-and-analyze cycle.

---

## Configuration

All settings are managed through the web UI at `/settings`:

| Setting | Description |
|---|---|
| **Subreddits** | Manage which subreddits to monitor and how often |
| **Filter Words** | Skip posts containing specific keywords (e.g., `[For Hire]`) |
| **Engineer Profile** | The profile text injected into AI prompts for scoring |
| **AI Provider** | Switch between OpenAI, OpenRouter, or Groq; choose model |
| **Fetch Max Age** | Skip posts older than N days (default: 60) |

---

## Architecture

```
Reddit JSON API → fetch-posts → Post table → analyze → ExtractedSignal → Lead → GeneratedMessage
                      │                                              ↑
                      └── BlockedKeyword filter ──────────────────────┘
```

- **`/api/fetch-posts`** — Fetches due subreddits, filters by age + keywords, upserts posts
- **`/api/analyze`** — Batches unanalyzed posts, sends to AI with engineer profile, stores signals
- **`/api/leads`** — CRUD for the lead pipeline
- **`/api/generate-message`** — Generates outreach messages using configured AI provider
- **`/api/subreddits`** — CRUD + CSV import/export for subreddits
- **`/api/settings/*`** — Settings CRUD (profile, AI config, blocked keywords, fetch age)

---

## Tech Stack

| Layer | Choice |
|---|---|
| Framework | [Next.js](https://nextjs.org) 16 (App Router) |
| Database | PostgreSQL + [Prisma](https://prisma.io) 7 |
| UI | [Tailwind CSS](https://tailwindcss.com) + [shadcn/ui](https://ui.shadcn.com) |
| AI | OpenAI SDK (multi-provider via OpenAI-compatible APIs) |
| Tests | [Jest](https://jestjs.io) |

---

## Development

```bash
npm run dev       # Start dev server
npm test          # Run tests
npx tsc --noEmit  # Type check
npx prisma db seed  # Re-seed the database
```

---

## License

[MIT](LICENSE)
