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
| `pnpm ingest:detail-backfill` | Visit Fresno / ticket-site detail pages (price, address) |
| `pnpm ingest:enrich` | AI enrichment backlog — run `--all` after promote |
| `pnpm ingest:post-promote` | **After all promotes:** detail-backfill `--all` + enrich `--all` + `review:reject-exclusions` + `db:backfill-addresses` |
| `pnpm review:reject-exclusions` | Auto-reject ingest exclusions (away games, Shen Yun); `--apply` to write |
| `pnpm ingest:scheduled-local` | Full pipeline: 3 promotes + post-promote + relink/orphan maintenance |
| `pnpm ingest:relink` | Occurrence relink maintenance (after full promote or matching-rule changes) |
| `POST /review/ops/published-orphan-cleanup` | Remove duplicate published events (API; `/admin` → Queue maintenance; `pnpm review:orphan-cleanup`) |
| `pnpm review:bulk-approve` | Approve all `pending_review` locally |

**Preflight vs promote:** separate commands. Preflight = dry-run (no `event_candidates`; venue runs write `venue_ingest_runs` debug).

**Logs:** Preflight and promote print a **source health** table plus a **Preflight summary**: one line per event (`Title… - /event/… - 6/3 6:50p`). Path is clickable (full URL in OSC 8). Set `NO_HYPERLINK=1` for plain text.

## Checklist (full promote-all on cloud-dev)

**Terminal 1:** `pnpm ingest:dev`  
**Terminal 2:** commands below. Start `pnpm dev:api` before relink orphan / pre-approve audit.

1. `pnpm env:status` — confirm `DEV_TARGET=cloud-dev`
2. `pnpm ingest:promote --source=ticketmaster --no-enrich`
3. `pnpm ingest:promote --source=venunite --no-enrich`
4. `pnpm ingest:promote-all --no-enrich`
5. `pnpm ingest:post-promote` (detail backfill, enrich, reject-exclusions, venue addresses)
6. `pnpm ingest:relink --dry-run` then `pnpm ingest:relink`
7. Orphan cleanup — preview then apply (`pnpm review:orphan-cleanup` or `/admin` → Queue maintenance)
8. **Agent review** — see [INGEST_LOCAL_OPS.md](INGEST_LOCAL_OPS.md) § Agent runbook (dupes, bad venues, pre-approve-audit)
9. `pnpm review:bulk-approve` when audit is clean

**One command:** `pnpm ingest:scheduled-local` runs steps 2–7 (agent review still step 8).

## Checklist (single source / preflight)

1. `pnpm ingest:preflight --source=<key>` then `pnpm ingest:promote --source=<key>`
2. Visit Fresno: `pnpm ingest:detail-backfill --source=api:visitfresnocounty --all` then scoped enrich
3. Studio: filter `event_candidates` by `source`; `/admin` → **New** / **Updates** tabs

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
