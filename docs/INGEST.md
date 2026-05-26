# Data ingestion (simple overview)

You only need to remember **three steps**:

1. **Fetch** — pull raw events from a source (official API, or HTML + AI).
2. **Save to dev** — normalize into `event_candidates` in your **dev** database.
3. **Review** — open `/admin`, approve or reject. Approved rows become `events` on dev. **Prod** gets copies later via promote (one approval, not twice).

Cron is the same script on a schedule. When you merge ingest changes to `main`, the next cron run (or a manual trigger in Cloudflare) uses the new code.

---

## Where things live in the repo

| What | Where |
| --- | --- |
| Source list (Ticketmaster, ai-discovery, …) | [`workers/ingest/src/registry.ts`](../workers/ingest/src/registry.ts) |
| Civic / venue URLs (legacy) | [`workers/ingest/src/sources/civic-urls.ts`](../workers/ingest/src/sources/civic-urls.ts) |
| Crawl seeds (ai-crawl) | `public.seed_urls` + [AI_CRAWLER.md](AI_CRAWLER.md) |
| Per-source fetch logic | [`workers/ingest/src/scrapers/`](../workers/ingest/src/scrapers/) |
| Run orchestration | [`workers/ingest/src/runner.ts`](../workers/ingest/src/runner.ts) |
| Manual script | `pnpm ingest:run` → [`scripts/ingest-run.sh`](../scripts/ingest-run.sh) |

There is **no** `event_sources` table. Each scraper in the registry has `schedule` (`cron` | `manual-only`) and `defaultCadenceMinutes`. Cron runs all `schedule: cron` sources that are **due** (last run in `ingest_runs` + cadence) and **runnable** (required secrets present). `GET /health` on the ingest worker lists `lastRunAt` per source.

---

## Safe real run (cloud dev)

Use the scripted gate before writing candidates: [INGEST_TESTING.md](INGEST_TESTING.md) (`pnpm ingest:preflight`, `pnpm ingest:promote`, admin bulk delete for cleanup).

## Local workflow

**Prerequisites:** See [LAUNCH_PLAN.md](LAUNCH_PLAN.md) Phase 1 (Docker, DB, secrets).

**Terminal 1 — ingest worker**

```bash
pnpm ingest:dev
```

**Terminal 2 — run fetchers**

```bash
# Preview without writing to the database
pnpm ingest:run --source=ticketmaster --dry-run

# One source → dev event_candidates
pnpm ingest:run --source=ticketmaster --force

# Several sources
pnpm ingest:run --source=ticketmaster,ai-discovery --force

# Every source that has API keys / AI configured
pnpm ingest:run --all --force

# Cron-style: schedule=cron sources that are due (visit, milb, downtown, ai-crawl, …)
pnpm ingest:run
```

**Terminal 3 — review**

```bash
pnpm dev
```

Open http://localhost:5182/admin → approve candidates → browse http://localhost:5182.

Check raw rows: Supabase Studio http://127.0.0.1:54423 → `event_candidates`, `ingest_runs`.

---

## Sources at a glance

| Key | How it fetches | Needs in `.dev.vars` | Cron schedule | Cadence (typical) |
| --- | --- | --- | --- | --- |
| `ticketmaster` | Official API | `TICKETMASTER_API_KEY` | cron | 6h |
| `visit-fresno-api` | CMS REST | `VISIT_FRESNO_API_TOKEN` | cron | 6h |
| `milb-api` | statsapi | — | cron | 12h |
| `downtown-fresno-api` | CityLight BBQ HTML + BR detail `/do/*` | `CLOUDFLARE_*` + LLM for details (BBQ key in code) | cron | 7d |
| `seed-special-url` | Custom HTML parsers | — | cron | 12h |
| `ai-crawl` | Browser Rendering `/crawl` + LLM | `CLOUDFLARE_*`, LLM | cron | 24h — [AI_CRAWLER.md](AI_CRAWLER.md) |
| `eventbrite` | Official API | `EVENTBRITE_API_KEY` | manual-only | — |
| `seatgeek` | Official API | `SEATGEEK_*` | manual-only | — |
| `bandsintown` | Official API | `BANDSINTOWN_APP_ID` | manual-only | — |
| `ai-discovery` | Fetch HTML + LLM (legacy) | LLM | manual-only | — |

`pnpm ingest:run --all --force` runs every **runnable** source, including `manual-only` (ignores `schedule`). Plain `pnpm ingest:run` uses cron rules only.

To add a crawl seed: `INSERT` into `seed_urls` (or Studio).  
To add a new API source: add a file under `scrapers/` and register it in `registry.ts`.

**Event priority (0–5)** is editorial: set at admin approve time on published `events`, default `5`. Not assigned during ingest.

**Re-scrape behavior:** `event_candidates.content_fingerprint` detects content changes. Unchanged rows keep their review status. Approved rows that changed go to `needs_changes`. Linked published `events` always get `last_seen_at` updated; title/start/description patch when content changed.

---

## Later: cron and time windows

Not built yet, but the intended model:

- **Daily job** — near-term events only (e.g. next 1–3 months); uses `schedule: cron` sources when due.
- **Weekly job** — far-future sweep (e.g. 3–24 months); separate schedule or `--sources` list once implemented in scrapers.

Improvements (better errors, date filters, per-site tuning) ship in ingest code; deploy to dev worker, then prod when ready. No database migration required for URL lists.

---

## Promote to prod (reminder)

Review happens **once** on dev. Promoting copies approved `events` to prod (API not fully wired yet — see README roadmap). You do not approve again on prod.
