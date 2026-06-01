# Venue ingest

**Implementation backlog:** [INGEST_DISCOVERY_AND_DETAIL_PLAN.md](INGEST_DISCOVERY_AND_DETAIL_PLAN.md)

**Cross-source dedupe:** [CROSS_SOURCE_DEDUPE.md](CROSS_SOURCE_DEDUPE.md) — `occurrence_id`, grouped admin review, `INGEST_CROSS_SOURCE_DEDUPE`.

**Series events:** [SERIES_EVENTS.md](SERIES_EVENTS.md) — recurring shows, canonical `seriesId`, batch dedupe. Plan: [SERIES_EVENTS_PLAN.md](SERIES_EVENTS_PLAN.md).

Single ingest path for Fresno venue sources: **repo modules** under `workers/ingest/src/venues/<key>/`, orchestrated by the **`venue-ingest`** scraper. Replaces legacy `ai-crawl`, `seed_urls`, and separate API registry keys.

Each venue has:

- `venue.config.json` — `enabled`, URLs, strategy, caps (toggle in git, not the database)
- `run.ts` — discover + parse (or delegates to shared API scraper logic)

Operational state: `venue_ingest_state`, history: `venue_ingest_runs` (dry-runs use `status = dry_run`).

## Ingest lanes

| Lane | Venues (enabled) | `strategy` values | Promote needs BR + LLM? |
| --- | --- | --- | --- |
| **direct** | visit-fresno-county, downtown-fresno, milb-grizzlies | `api` | No |
| **browser** | tower, save-mart, strummers, fulton-55, chaffee-zoo, convention center, rainbow, big fair, **gobulldogs** (Sidearm SPA) | listing / scroll strategies + `html_parse` with `ingestLane: browser` | Yes |

Lane is derived from `strategy` in code (`venue-lanes.utils.ts`); no extra config field.

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
# By lane
pnpm ingest:preflight-direct      # API + html_parse (no BR)
pnpm ingest:preflight-browser     # BR crawl venues
pnpm ingest:promote-direct
pnpm ingest:promote-browser

# Everything
pnpm ingest:preflight-all
pnpm ingest:promote-all

# One venue
pnpm ingest:preflight --venue=tower-theatre
pnpm ingest:promote --venue=strummers
```

Trigger: `POST /trigger?venue=tower-theatre&force=true&dry_run=true` (source defaults to `venue-ingest`)

**Deprecated (aliases):** `pnpm ingest:preflight-crawl` / `promote-crawl` → **browser** lane.

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
3. Preflight: `pnpm ingest:preflight --venue=<key>`.

Cron runs **`venue-ingest`** only (no `seed_urls`, no `ai-crawl`).
