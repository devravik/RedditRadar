<picture>
  <source media="(prefers-color-scheme: dark)" srcset="https://socialify.git.ci/devravik/RedditRadar/image?description=1&font=Inter&language=1&name=1&owner=1&pattern=Solid&theme=Dark" />
  <img alt="RedditRadar" src="https://socialify.git.ci/devravik/RedditRadar/image?description=1&font=Inter&language=1&name=1&owner=1&pattern=Solid&theme=Light" />
</picture>

**RedditRadar** is a self-hosted Reddit lead discovery and AI analysis platform for engineers. Monitor hiring posts and founder pain points across dozens of subreddits, score them against your profile, and manage your pipeline — all from your own infrastructure.

Built with [Next.js](https://nextjs.org) 16, [Prisma](https://prisma.io) 7, PostgreSQL, and [Tailwind CSS](https://tailwindcss.com).

---

## Why I Built RedditRadar

I was manually searching Reddit for hiring posts, founder pain points, and engineering opportunities across dozens of subreddits.

The process was repetitive and hard to track consistently. I'd find a promising post, forget to follow up, lose the link, or waste time reading noise.

RedditRadar automates:
- Subreddit monitoring on configurable schedules
- Filtering noise with keyword blocks and pattern-based pre-filtering
- AI-based lead scoring against a custom engineer profile
- Outreach message drafting via AI
- Pipeline tracking from new lead to contacted to closed

The goal was a lightweight self-hosted system that replaces expensive SaaS alternatives and fits into my own outbound workflow.

---

## Features

- **Subreddit Manager** — Add, remove, enable/disable subreddits; configure per-subreddit fetch intervals (hourly/daily/weekly). Bulk import/export via CSV.
- **Smart Fetching** — Fetches posts from Reddit's JSON API with configurable max post age, keyword blocking, pattern-based pre-filtering, and rate-limit-aware pacing (1.5s pause between subreddits).
- **AI Analysis** — Analyzes posts using OpenAI, OpenRouter, or Groq against your custom engineer profile. Extracts technologies, pain points, seniority level, remote suitability, startup stage, and match score (0–100).
- **Pre-Filtering** — Before the LLM runs, posts are checked against noise patterns (resume reviews, weekly threads, advice-seeking, hardware shopping, etc.) to avoid wasting inference cost on obvious non-opportunities.
- **Lead Pipeline** — Track promising leads through NEW → CONTACTED → REPLIED → ARCHIVED stages; generate outreach messages (Reddit DM, Email, LinkedIn) via AI.
- **Auto-Lead Creation** — Posts scoring above a configurable threshold (default 70) automatically become leads.
- **Post Browser** — Search and filter all imported posts by keyword, subreddit, analysis status, match score range, and lead status.
- **Settings Hub** — Configure subreddits, filter keywords, engineer profile, AI provider/model, fetch age limits, and lead threshold from the UI.

---

## Prerequisites

- **Node.js** 20+
- **PostgreSQL** 14+
- An API key from one of: [OpenAI](https://platform.openai.com), [OpenRouter](https://openrouter.ai), or [Groq](https://groq.com)

---

## Quick Start

### 1. Clone and install

```bash
git clone https://github.com/devravik/RedditRadar.git
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

## Deployment

### Docker

```bash
docker build -t redditradar .
docker run -p 3000:3000 \
  -e DATABASE_URL="postgresql://..." \
  -e OPENAI_API_KEY="sk-..." \
  redditradar
```

### VPS (Ubuntu + nginx + systemd)

1. Clone the repo, install deps, configure `.env.local`
2. Build: `npm run build`
3. Serve with `npx next start -p 3000`
4. Reverse-proxy with nginx and manage with systemd or PM2

### Railway / DigitalOcean App Platform

1. Connect your GitHub repo
2. Set `DATABASE_URL` and API keys as environment variables
3. Set build command: `npm run build`
4. Set start command: `npx next start`

Requirements: Node.js 20+, PostgreSQL 14+ (managed Postgres from your provider).

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
| **Lead Threshold** | Minimum match score (0–100) for auto-creating a lead |

---

## Architecture

```
Reddit JSON API → fetch-posts → Post table → pre-filter → analyze → ExtractedSignal → Lead → GeneratedMessage
                      │                                                    ↑
                      ├── BlockedKeyword filter ────────────────────────────┘
                      └── Noise pattern pre-filter
```

- **`/api/fetch-posts`** — Fetches due subreddits, filters by age + blocked keywords + noise patterns, upserts posts
- **`/api/analyze`** — Batches unanalyzed posts, pre-filters known noise, sends remaining posts to AI, stores signals and auto-creates leads
- **`/api/leads`** — CRUD for the lead pipeline
- **`/api/generate-message`** — Generates outreach messages using configured AI provider
- **`/api/subreddits`** — CRUD + CSV import/export for subreddits
- **`/api/settings/*`** — Settings CRUD (profile, AI config, blocked keywords, fetch age, lead threshold)

---

## Engineering Notes

### Rate-limit handling
Reddit's JSON API tolerates moderate request rates. The fetcher inserts a **1.5s pause** between subreddit fetches. Uncapped bursts are avoided by processing one subreddit at a time within the API route.

### Batching strategy
The analyze endpoint processes posts in batches of **20 per request** to keep LLM costs predictable. Each click of "Analyze Posts" incurs at most 20 inference calls.

### Idempotent upserts
Both `fetch-posts` and `analyze` use Prisma `upsert` keyed on `redditId` and `postId` respectively. Re-running the same pipeline is safe — duplicate data is never created.

### AI cost optimization
- **Pre-filtering**: Before any LLM inference, noise patterns (resume reviews, weekly threads, advice-seeking, etc.) are matched against title/body. Posts matching known non-opportunity patterns are skipped entirely.
- **Multi-provider support**: Switch between OpenAI, OpenRouter, or Groq. Groq and OpenRouter typically offer cheaper/faster inference for the same task.
- **Configurable analysis depth**: The batch size and model are both configurable, allowing you to trade off coverage vs. cost.

### Prompt structure
The AI system prompt is composed of:
1. A static instruction template defining the output JSON schema
2. The user's **engineer profile** injected at analysis time
3. The post title and body as the user message

This structure makes the prompt easy to iterate on without code changes.

### Scheduling
There is no built-in cron/background job. Fetches and analysis are triggered manually from the UI. This keeps the architecture simple and avoids the complexity of queue management. A cron-based scheduler can be added by hitting the API routes externally.

### Pre-filter patterns
The pre-filter (`src/lib/prefilter.ts`) uses regex patterns matched against post title and body. Current categories: resume reviews, business-name-only posts, weekly/megathreads, welcome/intros, advice-seeking, learning questions, hardware shopping, showcase reviews, and opinion polls. Posts with empty bodies and low engagement scores are also filtered.

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

## Roadmap

- [ ] Background queue workers for scheduled fetching and analysis
- [ ] Multi-user support with teams and role-based access
- [ ] Chrome extension to save Reddit posts directly to the pipeline
- [ ] Semantic duplicate detection across subreddits
- [ ] Telegram / Discord alerts for high-match posts
- [ ] Vector similarity search for lead-to-lead matching

---

## Development

```bash
npm run dev       # Start dev server
npm test          # Run tests
npx tsc --noEmit  # Type check
npx prisma db seed  # Re-seed the database
```

---

## Maintainer

**Ravi K Gupta**

- Website: [devravik.github.io](https://devravik.github.io)
- Email: [dev.ravikgupt@gmail.com](mailto:dev.ravikgupt@gmail.com)
- LinkedIn: [linkedin.com/in/ravi-k-dev](https://linkedin.com/in/ravi-k-dev)
- GitHub: [github.com/devravik](https://github.com/devravik)

---

## License

[MIT](LICENSE)
