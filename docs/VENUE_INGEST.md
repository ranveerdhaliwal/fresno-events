# Venue ingest

Single ingest path for Fresno venue sources: **repo modules** under `workers/ingest/src/venues/<key>/`, orchestrated by the **`venue-ingest`** scraper. Replaces legacy `ai-crawl`, `seed_urls`, and separate API registry keys.

Each venue has:

- `venue.config.json` — `enabled`, URLs, strategy, caps (toggle in git, not the database)
- `run.ts` — discover + parse (or delegates to shared API scraper logic)

Operational state: `venue_ingest_state`, history: `venue_ingest_runs` (dry-runs use `status = dry_run`).

## Enabled venues

| Key | Strategy | Candidate `source` (typical) |
|-----|----------|------------------------------|
| `tower-theatre` | `listing_then_detail` | `scrape:towertheatre.ticketsauce.com` |
| `save-mart` | `month_windows_then_detail` | `scrape:www.savemartcenter.com` |
| `fresno-convention-center` | `listing_then_detail` | scrape host |
| `chaffee-zoo` | `listing_then_detail` | scrape host |
| `fulton-55` | `listing_then_detail` | scrape host |
| `strummers` | `listing_then_detail` | scrape host |
| `rainbow-ballroom` | `scroll_listing_then_detail` | scrape host |
| `big-fresno-fair` | `scroll_listing_then_detail` | scrape host |
| `gobulldogs` | `html_parse` | scrape host |
| `visit-fresno-county` | `api` | `api:visitfresnocounty` |
| `downtown-fresno` | `api` | `api:downtownfresno` |
| `milb-grizzlies` | `api` | `api:milb` |

## Commands

Prerequisite: `pnpm ingest:dev` and `pnpm db:migrate` (or `pnpm db:reset`).

```bash
# All enabled venues (dry-run)
pnpm ingest:preflight-venues

# One crawl venue
pnpm ingest:preflight --source=venue-ingest --venue=tower-theatre

# API venues only (visit + downtown + milb)
pnpm ingest:preflight-apis
pnpm ingest:promote-apis

# Real promote (all venues or filtered)
pnpm ingest:promote-venues
pnpm ingest:promote --source=venue-ingest --venue=save-mart --no-enrich
```

Trigger: `POST /trigger?source=venue-ingest&venue=tower-theatre&force=true&dry_run=true`

**Deprecated (aliases):** `pnpm ingest:preflight-crawl` / `promote-crawl` → venue scripts.

## Verify

```sql
SELECT venue_key, status, events_found, debug
FROM venue_ingest_runs
ORDER BY started_at DESC
LIMIT 10;
```

## Adding a venue

1. Create `venues/<key>/venue.config.json` + `run.ts`.
2. Register in `venues/registry.ts`.
3. Preflight: `pnpm ingest:preflight --source=venue-ingest --venue=<key>`.

Cron runs **`venue-ingest`** only (no `seed_urls`, no `ai-crawl`).
