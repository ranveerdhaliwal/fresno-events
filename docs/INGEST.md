# Data ingestion (simple overview)

You only need to remember **three steps**:

1. **Fetch** — pull raw events from a registered source (venue module, Ticketmaster, or VenuNite).
2. **Save to dev** — normalize into `event_candidates` in your **dev** database.
3. **Review** — open `/admin`, approve or reject. Approved rows become `events` on dev. **Prod** gets copies later via promote (one approval, not twice). On approve, `upsertVenue` writes `venues.address` / `city` / `lat` / `lng` (geocoding when coords missing — see [VENUE_LOCATION.md](VENUE_LOCATION.md)).

Cron is the same script on a schedule. When you merge ingest changes to `main`, the next cron run (or a manual trigger in Cloudflare) uses the new code.

---

## Where things live in the repo

| What | Where |
| --- | --- |
| **Venue addresses, lat/lng, geocoding, maps** | **[VENUE_LOCATION.md](VENUE_LOCATION.md)** |
| Scraper registry (`ticketmaster`, `venunite`, `venue-ingest`) | [`workers/ingest/src/registry.ts`](../workers/ingest/src/registry.ts) |
| Venue modules (12 enabled) | [`workers/ingest/src/venues/`](../workers/ingest/src/venues/) — [VENUE_INGEST.md](VENUE_INGEST.md) |
| Shared API/HTML logic used by venue modules | [`workers/ingest/src/scrapers/`](../workers/ingest/src/scrapers/) (e.g. `visit-fresno-api.utils.ts`, not separate registry keys) |
| Run orchestration | [`workers/ingest/src/runner.ts`](../workers/ingest/src/runner.ts) |
| Manual script | `pnpm ingest:run` → [`scripts/ingest-run.sh`](../scripts/ingest-run.sh) |

There is **no** `event_sources` or `seed_urls` table. Each scraper in the registry has `schedule: cron` and `defaultCadenceMinutes`. Cron runs all cron sources that are **due** (last run in `ingest_runs` + cadence) and **runnable** (required secrets present). `GET /health` on the ingest worker lists `lastRunAt` per source.

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
pnpm ingest:run --source=ticketmaster,venunite --force

# Every runnable source
pnpm ingest:run --all --force

# Cron-style: schedule=cron sources that are due
pnpm ingest:run

# One venue module
pnpm ingest:promote --source=strummers
```

**Terminal 3 — review**

```bash
pnpm dev
```

Open http://localhost:5182/admin → approve candidates → browse http://localhost:5182.

Check raw rows: Supabase Studio http://127.0.0.1:54423 → `event_candidates`, `ingest_runs`.

---

## Sources at a glance

| Scraper key | What it runs | Needs in `.dev.vars` | Cadence (typical) |
| --- | --- | --- | --- |
| `venue-ingest` | All 12 venue modules in `workers/ingest/src/venues/` | `CLOUDFLARE_*` (browser lane) | 6h — [VENUE_INGEST.md](VENUE_INGEST.md) |
| `ticketmaster` | Ticketmaster Discovery API (paginated) | `TICKETMASTER_API_KEY` | 24h — [TICKETING_SOURCES.md](TICKETING_SOURCES.md) |
| `venunite` | VenuNite REST aggregator (Fresno) | — | 14d — [TICKETING_SOURCES.md](TICKETING_SOURCES.md) |

**Venue modules** (via `venue-ingest`, not separate registry keys): visit-fresno-county, downtown-fresno, milb-grizzlies, gobulldogs, tower-theatre, save-mart, fresno-convention-center, chaffee-zoo, fulton-55, strummers, rainbow-ballroom, big-fresno-fair.

To add a venue: create `venues/<key>/venue.config.json` + `run.ts`, register in `venues/registry.ts`. See [VENUE_INGEST.md](VENUE_INGEST.md).

**Event priority (0–5)** is editorial: set at admin approve time on published `events`, default `5`. Not assigned during ingest.

**Re-scrape behavior:** `event_candidates.content_fingerprint` detects content changes. Unchanged rows keep their review status and enrichment fields; persist only bumps `run_id` / `updated_at` (plus occurrence/link fields when cross-source dedupe applies). Approved rows that changed go to `needs_changes` and appear in the admin **Updates** tab.

Structured persist logs: `ingest_candidate_new`, `ingest_candidate_changed`, and `ingest_persist_summary` (also stored on `ingest_runs.metrics.audit`).

---

## Promote to prod (reminder)

Review happens **once** on dev. Promoting copies approved `events` to prod (API not fully wired yet — see README roadmap). You do not approve again on prod.
