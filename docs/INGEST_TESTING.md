# Ingest testing (safe real runs)

Cloud dev Studio: [event_candidates table](https://supabase.com/dashboard/project/mrfkpvbvgzbtcutulfnc/editor)

**Which database?** Admin → local API (`VITE_API_URL`) → `apps/api` `SUPABASE_URL`. Ingest uses `workers/ingest` `SUPABASE_URL`. Switch together via `pnpm env:local` or `pnpm env:cloud-dev` (`pnpm env:status` to verify).

## Commands

| Command | What it does |
| --- | --- |
| `pnpm ingest:dev` | Start local ingest worker (terminal 1) |
| `pnpm ingest:preflight-all` | Dry-run **all** enabled venue sources |
| `pnpm ingest:promote-all` | **Real** persist — all enabled venue sources |
| `pnpm ingest:preflight --source=<key>` | Dry-run one source (venue key, `api:…`, `ticketmaster`, …) |
| `pnpm ingest:promote --source=<key>` | **Real** persist one source |
| `pnpm ingest:detail-backfill` | Visit Fresno HTML detail prices (when still pending) |
| `pnpm ingest:enrich` | AI enrichment backlog (usually automatic after promote) |
| `pnpm ingest:relink` | Occurrence relink maintenance |
| `pnpm review:bulk-approve` | Approve all `pending_review` locally |

**Preflight vs promote:** separate commands. Preflight = dry-run (no `event_candidates`; venue runs write `venue_ingest_runs` debug).

**Logs:** Preflight and promote print a **source health** table plus a **Preflight summary**: one line per event (`Title… - /event/… - 6/3 6:50p`). Path is clickable (full URL in OSC 8). Set `NO_HYPERLINK=1` for plain text.

## Checklist

1. `pnpm ingest:preflight-all` then `pnpm ingest:promote-all` (all venue sources)
2. `pnpm ingest:preflight --source=ticketmaster` then `pnpm ingest:promote --source=ticketmaster`
3. Studio: filter `event_candidates` by `source`
4. `/admin` — **New** tab for `pending_review`, **Updates** tab for `needs_changes`
5. Visit Fresno preflight: batch duplicate section when dupes exist; ~239 events after within-batch dedupe
6. Recurring rows: `normalized_event->>'seriesId'` matches `/^series:[^:]+:[a-f0-9]{64}$/`

## Expected counts (soft warnings)

| Source (`--source=` or admin filter) | Typical count |
| --- | --- |
| `api:visitfresnocounty` | ~239 (after batch dedupe) |
| `api:milb` | ~88 |
| `api:downtownfresno` | ~27 |
| `tower-theatre` / `scrape:towertheatre.ticketsauce.com` | varies |
| `ticketmaster` | ~200 |

Hard validation fails on duplicate `sourceEventId` in one batch, missing required fields, or errors over budget.

See [VENUE_INGEST.md](VENUE_INGEST.md) and [SERIES_EVENTS.md](SERIES_EVENTS.md).
