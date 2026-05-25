# Subreddit Manager Design

**Feature:** Manage monitored subreddits from a settings page with per-subreddit scheduling and CSV import/export.

**Replaces:** Hardcoded `SUBREDDITS` constant in `src/lib/reddit.ts`.

---

## Goals

- Add, remove, enable/disable subreddits from the UI without touching code
- Set per-subreddit fetch intervals (Hourly / Daily / Weekly)
- Import a subreddit list from CSV (merge - additive, no deletions)
- Export the current list to CSV

---

## Data Model

New Prisma model added to `prisma/schema.prisma`:

```prisma
model Subreddit {
  id            String        @id @default(cuid())
  name          String        @unique  // bare name, no "r/" prefix - e.g. "startups"
  enabled       Boolean       @default(true)
  fetchInterval FetchInterval @default(DAILY)
  lastFetchedAt DateTime?
  createdAt     DateTime      @default(now())
}

enum FetchInterval {
  HOURLY   // fetch if lastFetchedAt < now - 1h
  DAILY    // fetch if lastFetchedAt < now - 24h
  WEEKLY   // fetch if lastFetchedAt < now - 7d
}
```

**Seeding:** `prisma/seed.ts` inserts the 8 original subreddits (forhire, hiring, startups, SaaS, webdev, laravel, golang, remotework) as DAILY/enabled if the table is empty. Run via `npx prisma db seed`.

**Migration:** One new migration adding the `Subreddit` table and `FetchInterval` enum.

---

## API Routes

### `GET /api/subreddits`
Returns all subreddits ordered by name.

**Response:**
```json
[
  { "id": "...", "name": "startups", "enabled": true, "fetchInterval": "DAILY", "lastFetchedAt": "2026-05-25T10:00:00Z", "createdAt": "..." }
]
```

### `POST /api/subreddits`
Add a subreddit.

**Request body:**
```json
{ "name": "startups", "fetchInterval": "DAILY" }
```

**Validation:** name required, strip leading `r/` if present, normalize to lowercase, alphanumeric + underscores only (Reddit name rules). Return 400 on invalid format. Return 409 if name already exists.

**Response:** 201 with created subreddit.

### `PATCH /api/subreddits/[id]`
Update `enabled` and/or `fetchInterval`.

**Request body:** `{ "enabled": false }` or `{ "fetchInterval": "WEEKLY" }` or both.

**Validation:** `fetchInterval` must be HOURLY, DAILY, or WEEKLY if provided. Return 400 otherwise. Return 404 if id not found.

**Response:** 200 with updated subreddit.

### `DELETE /api/subreddits/[id]`
Remove a subreddit. Returns 404 if not found, 200 on success.

### `GET /api/subreddits/export`
Download all subreddits as CSV.

**Response:** `Content-Type: text/csv`, `Content-Disposition: attachment; filename="subreddits.csv"`

**CSV format:**
```
name,enabled,fetchInterval
startups,true,DAILY
laravel,true,HOURLY
golang,false,WEEKLY
```

### `POST /api/subreddits/import`
Accept CSV as plain text request body (`Content-Type: text/csv`).

**Behavior:** Parse CSV, for each row: insert if name not already in DB, skip if it exists (merge = additive only, never updates existing subreddit settings, never deletes). Strip `r/` prefix, normalize to lowercase, validate name format (alphanumeric + underscores). Return 400 on malformed CSV.

**Response:**
```json
{ "added": 3, "skipped": 5 }
```

---

## Fetch Pipeline Changes

### `src/lib/reddit.ts`

- Remove `SUBREDDITS` constant
- Remove `fetchAllSubredditPosts()`
- Add `fetchDueSubredditPosts(): Promise<{ posts: RedditPost[], subreddits: string[] }>`

**Logic:**
1. Query DB: `prisma.subreddit.findMany({ where: { enabled: true } })`
2. Filter in JS to subreddits that are "due":
   - `lastFetchedAt` is null, OR
   - `lastFetchedAt` + interval ≤ now (HOURLY=3600s, DAILY=86400s, WEEKLY=604800s)
3. For each due subreddit: call `fetchSubredditPosts(name)`
4. On success: update `lastFetchedAt = now` in DB
5. On error: log, skip (same graceful behavior as before)
6. Return all collected posts + list of successfully fetched subreddit names

### `POST /api/fetch-posts`

- Calls `fetchDueSubredditPosts()` instead of `fetchAllSubredditPosts()`
- Response gains `subreddits` field:

```json
{ "fetched": 47, "subreddits": ["startups", "laravel"] }
```

### `src/components/pipeline-buttons.tsx`

- After successful fetch, display: `"Fetched {N} posts from {subreddits.join(', ')}"` or `"No subreddits due for fetching"` if subreddits is empty.

---

## Settings Page UI

### Navigation

`src/app/layout.tsx` gets a "Settings" link in the header pointing to `/settings/subreddits`.

### `/settings/subreddits` - `src/app/settings/subreddits/page.tsx`

Server component. Fetches subreddit list from DB directly via Prisma. Renders three sections:

#### Subreddit Table

One row per subreddit:

| Column | Detail |
|---|---|
| Name | `r/startups` |
| Enabled | Toggle (client component: `SubredditToggle`) - PATCHes `/api/subreddits/[id]` on change |
| Interval | Select: Hourly / Daily / Weekly (client component: `IntervalSelect`) - PATCHes on change |
| Last Fetched | Relative timestamp ("2h ago", "never") - server-rendered |
| Actions | Delete button - confirms in-line, then DELETEs, triggers router.refresh() |

Client components (`SubredditToggle`, `IntervalSelect`) are small focused components, not a full client page.

#### Add Subreddit Form

Inline below table. Client component `AddSubredditForm`:
- Text input: subreddit name (placeholder: `startups` or `r/startups`)
- Select: fetch interval (default: Daily)
- Add button → POST `/api/subreddits` → on success, `router.refresh()`
- Inline error display (e.g. "Already exists", "Invalid name")

#### CSV Section

Two actions, no modal:

**Export:** `<a href="/api/subreddits/export" download="subreddits.csv">` - simple anchor tag, browser handles download.

**Import:**
- File input (accept `.csv`)
- Import button (client component `CsvImportButton`)
- On click: reads file as text, POSTs to `/api/subreddits/import` with `Content-Type: text/csv`
- Shows result: `"3 subreddits added, 5 already existed"` or error message

---

## New Files

```
src/
├── app/
│   ├── settings/
│   │   └── subreddits/
│   │       └── page.tsx                    # Server component - settings page
│   └── api/
│       └── subreddits/
│           ├── route.ts                    # GET list, POST create
│           ├── [id]/
│           │   └── route.ts               # PATCH update, DELETE remove
│           ├── export/
│           │   └── route.ts               # GET CSV download
│           └── import/
│               └── route.ts              # POST CSV import
├── components/
│   ├── subreddit-toggle.tsx               # Enabled on/off toggle
│   ├── interval-select.tsx                # Hourly/Daily/Weekly select
│   ├── add-subreddit-form.tsx             # Add subreddit inline form
│   └── csv-import-button.tsx             # File picker + POST import
prisma/
└── seed.ts                                # Seed 8 default subreddits
```

## Modified Files

```
prisma/schema.prisma                       # Add Subreddit model + FetchInterval enum
src/lib/reddit.ts                          # Replace SUBREDDITS const + fetchAll with fetchDue
src/app/api/fetch-posts/route.ts           # Use fetchDueSubredditPosts, return subreddits[]
src/components/pipeline-buttons.tsx        # Show which subreddits were fetched
src/app/layout.tsx                         # Add Settings nav link
src/types/index.ts                         # Add FetchInterval type
```

---

## Tests

- `src/lib/__tests__/reddit.test.ts` - update existing tests; add tests for `fetchDueSubredditPosts` with mocked DB (due/not-due/disabled subreddits)
- `src/app/api/__tests__/subreddits.test.ts` - test GET, POST (valid/invalid/duplicate), PATCH, DELETE, import (valid CSV, malformed CSV, duplicate handling), export CSV format
- `src/app/api/__tests__/fetch-posts.test.ts` - update to mock `fetchDueSubredditPosts` instead of `fetchAllSubredditPosts`

---

## Out of Scope

- Verifying a subreddit exists on Reddit before adding it
- Per-subreddit post limits (all use limit=25)
- Automatic background scheduling (fetch is always manually triggered or called externally)
- Pagination on the settings page
