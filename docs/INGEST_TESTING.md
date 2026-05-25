# Ingest testing (safe real runs)

Cloud dev Studio: [event_candidates table](https://supabase.com/dashboard/project/mrfkpvbvgzbtcutulfnc/editor)

**Which database?** Admin → local API (`VITE_API_URL`) → `apps/api` `SUPABASE_URL`. Ingest uses `workers/ingest` `SUPABASE_URL`. Switch together via `pnpm env:local` or `pnpm env:cloud-dev` (`pnpm env:status` to verify).

## Commands

| Command | What it does |
| --- | --- |
| `pnpm ingest:dev` | Start local ingest worker (terminal 1) |
| `pnpm ingest:preflight-apis` | Dry-run API sources + validation |
| `pnpm ingest:preflight-crawl` | Dry-run ai-crawl (**plan only**, no BR jobs) |
| `pnpm ingest:preflight --source=<key>` | Dry-run one source |
| `pnpm ingest:promote-apis` | **Real** APIs + gobulldogs; then enriches **all** pending rows that still need LLM |
| `pnpm ingest:promote-crawl` | **Real** ai-crawl only; same post-run enrichment as APIs |
| `pnpm ingest:promote --source=<key>` | **Real** only — does not run preflight |
| `pnpm db:push-cloud-dev --yes` | Copy local `event_candidates` + `ingest_runs` to cloud dev |
| `pnpm ingest:run --source=<key> --dry-run --force` | Dry-run only (no DB) |
| `pnpm ingest:run --source=<key> --force --no-enrich` | Real run, skip background enrichment |
| `pnpm ingest:enrich --dry-run --limit=5` | Preview AI enrichment (no PATCH) |
| `pnpm ingest:enrich --source=api:visitfresnocounty --limit=3` | Enrich up to N pending rows for one source |
| `pnpm ingest:enrich --all` | Enrich all pending without `[ai]` notes, in batches of 100 until done |

## What is `ai-crawl`?

Registry key **`ai-crawl`** = Browser Rendering crawl of `seed_urls` where `lane = 'crawl'`. Not the same as `visit-fresno-api` / `downtown-fresno-api` (REST). Prefer **`pnpm ingest:promote-apis`** then **`pnpm ingest:promote-crawl`**.

**Preflight vs promote:** separate commands. Preflight = dry-run (no DB). Promote = real writes. For ai-crawl, dry-run only logs crawl plans — it does **not** start Cloudflare jobs anymore.

**Logs to watch:** `[ingest] Fetch phase complete` → `[ingest] AI enrichment starting` → batch lines → `[ingest] AI enrichment finished` → `[ingest] Run complete`. Crawl adds `[ingest] ai-crawl starting/finished` per source.

**Enrichment after promote:** processes every `pending_review` row that still needs LLM (no `[ai]` notes and missing description/category). Rows that already have full source text are tagged without calling the model. Use `pnpm ingest:promote-apis --no-enrich` then `pnpm ingest:enrich --all` to run enrichment separately.

**What enrichment writes:** always `confidence_score`, `suggested_priority`, `review_notes` (`[ai] …`); optionally updates `normalized_event` title/category/tags; auto-`rejected` when junk. Logs: `ai_enrichment_item_done` includes `changes` (before/after) and a `[ingest] enriched: …` one-liner.

**Cancel during crawl:** BR jobs keep running on Cloudflare unless cancelled (`DELETE` per [docs](https://developers.cloudflare.com/browser-run/quick-actions/crawl-endpoint/#cancel-a-crawl-job)). Stopping wrangler may leave a job running; use dashboard or wait for timeout.

## Checklist (one source)

1. `pnpm ingest:preflight-apis` (optional)
2. `pnpm ingest:promote-apis` (or `--no-enrich` then `pnpm ingest:enrich` separately)
3. `pnpm ingest:preflight-crawl` then `pnpm ingest:promote-crawl` when ready for venues
3. Studio: filter `event_candidates` by `source`, spot-check counts
4. `/admin`: filter pending, spot-check a few rows (list grouped by `suggested_priority`, then confidence)
5. After schema change: `pnpm db:migrate:local` (keeps data) or `pnpm db:reset` (wipe); cloud dev via `pnpm db:migrate:cloud-dev` or MCP; re-run `pnpm ingest:enrich` if needed
6. Bad data? Select rows in admin → **Delete selected**, or use SQL (see Cursor rule `ingest-operations`)

## Expected counts (soft warnings)

| Source key | `event_candidates.source` | Typical count |
| --- | --- | --- |
| `visit-fresno-api` | `api:visitfresnocounty` | ~224 |
| `milb-api` | `api:milb` | ~88 |
| `downtown-fresno-api` | `api:downtownfresno` | ~27 (BBQ list; optional BR+LLM per `/do/*` detail when `CLOUDFLARE_*` + LLM set) |
| `seed-special-url` | varies | 0+ (gobulldogs often 0) |

Hard validation fails on duplicate `sourceEventId` in one batch, missing required fields, or errors over budget.

## Emergency

Set `INGEST_SKIP_VALIDATION=true` in `.dev.vars` only when you intentionally bypass the gate (logged as `ingest_validation_skipped`).
