# Ingest testing (safe real runs)

Cloud dev Studio: [event_candidates table](https://supabase.com/dashboard/project/mrfkpvbvgzbtcutulfnc/editor)

**Which database?** Admin → local API (`VITE_API_URL`) → `apps/api` `SUPABASE_URL`. Ingest uses `workers/ingest` `SUPABASE_URL`. Switch together via `pnpm env:local` or `pnpm env:cloud-dev` (`pnpm env:status` to verify).

## Commands

| Command | What it does |
| --- | --- |
| `pnpm ingest:dev` | Start local ingest worker (terminal 1) |
| `pnpm ingest:preflight-apis` | Dry-run API venues (visit, downtown, milb) via `venue-ingest` |
| `pnpm ingest:preflight-venues` | Dry-run all enabled crawl venues |
| `pnpm ingest:preflight --source=venue-ingest --venue=<key>` | Dry-run one venue |
| `pnpm ingest:promote-apis` | **Real** API venues; then enriches pending rows |
| `pnpm ingest:promote-venues` | **Real** all enabled crawl venues |
| `pnpm ingest:promote --source=venue-ingest --venue=<key>` | **Real** one venue |
| `pnpm review:bulk-approve` | Approve all `pending_review` locally |
| `pnpm ingest:enrich --source=<event_candidates.source> --all` | Enrich by candidate source |

**Deprecated aliases:** `ingest:preflight-crawl` / `ingest:promote-crawl` → venue scripts.

**Preflight vs promote:** separate commands. Preflight = dry-run (no `event_candidates`; venue runs write `venue_ingest_runs` debug).

**Logs:** `[ingest] Fetch phase complete` → `AI enrichment starting` → `AI enrichment finished` → `Run complete`.

## Checklist

1. `pnpm ingest:preflight-apis` (optional)
2. `pnpm ingest:promote-apis`
3. `pnpm ingest:preflight-venues` then `pnpm ingest:promote-venues` for crawl venues
4. Studio: filter `event_candidates` by `source`
5. `/admin` review queue

## Expected counts (soft warnings)

| Venue key | `event_candidates.source` | Typical count |
| --- | --- | --- |
| `visit-fresno-county` | `api:visitfresnocounty` | ~224 |
| `milb-grizzlies` | `api:milb` | ~88 |
| `downtown-fresno` | `api:downtownfresno` | ~27 |
| `tower-theatre` | `scrape:towertheatre.ticketsauce.com` | varies |

Hard validation fails on duplicate `sourceEventId` in one batch, missing required fields, or errors over budget.

See [VENUE_INGEST.md](VENUE_INGEST.md).
