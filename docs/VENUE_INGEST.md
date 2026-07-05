# Venue ingest

**Cross-source dedupe:** [CROSS_SOURCE_DEDUPE.md](CROSS_SOURCE_DEDUPE.md) — `occurrence_id`, grouped admin review, `INGEST_CROSS_SOURCE_DEDUPE`.

**Series events:** [SERIES_EVENTS.md](SERIES_EVENTS.md) — recurring shows, canonical `seriesId`, batch dedupe.

**Venue location (address, geocode, maps):** [VENUE_LOCATION.md](VENUE_LOCATION.md) — per-source coords matrix, `upsertVenue`, address backfill, `GOOGLE_MAPS_PLATFORM_API_KEY`, admin maintenance ops.

Single ingest path for Fresno venue sources: **repo modules** under `workers/ingest/src/venues/<key>/`, orchestrated by the **`venue-ingest`** scraper.

Each venue has:

- `venue.config.json` — `enabled`, URLs, strategy, caps (toggle in git, not the database)
- `run.ts` — discover + parse (or delegates to shared API scraper logic)

Operational state: `venue_ingest_state`, history: `venue_ingest_runs` (dry-runs use `status = dry_run`).

**Detail tracking on candidates:** `event_candidates.detail_status` (`complete` \| `pending`) and `detail_page_url` (canonical show URL for backfill). Set on upsert from ingest; cap-skipped listing URLs persist as `pending`. Planned: detail backfill job (see multi-tier ingest plan).

## Ingest lanes

| Lane | Venues (enabled) | `strategy` values | Promote needs BR + LLM? |
| --- | --- | --- | --- |
| **direct** | visit-fresno-county, downtown-fresno, milb-grizzlies, **gobulldogs**, fulton-55, strummers | `api`, plain `html_parse` | No |
| **browser** | tower, save-mart, chaffee-zoo, convention center, rainbow, big fair | listing / scroll strategies | Yes |

Lane is derived from `strategy` in code (`venue-lanes.utils.ts`); no extra config field.

## Enabled venues

| Key | Strategy | Candidate `source` (typical) |
|-----|----------|------------------------------|
| `tower-theatre` | `listing_then_detail` | `scrape:towertheatre.ticketsauce.com` |
| `save-mart` | `month_windows_then_detail` | `scrape:www.savemartcenter.com` |
| `fresno-convention-center` | `listing_then_detail` | scrape host |
| `chaffee-zoo` | `listing_then_detail` | scrape host |
| `fulton-55` | `html_parse` (WFEA listing on homepage; Eventbrite ticket URLs) | `scrape:fulton55.com` |
| `strummers` | `html_parse` (Squarespace eventlist on `/shows`) | `scrape:www.strummersclub.com` |
| `rainbow-ballroom` | `scroll_listing_then_detail` | scrape host |
| `big-fresno-fair` | `scroll_listing_then_detail` | scrape host |
| `gobulldogs` | `api` (Sidearm `/api/v2/Calendar/from/.../to/...`) | `api:gobulldogs` |
| `visit-fresno-county` | `api` | `api:visitfresnocounty` |
| `downtown-fresno` | `api` | `api:downtownfresno` |
| `milb-grizzlies` | `api` | `api:milb` |

## Commands

Prerequisite: `pnpm ingest:dev` and `pnpm db:migrate` (or `pnpm db:reset`).

```bash
pnpm ingest:preflight-all
pnpm ingest:promote-all

pnpm ingest:preflight --source=tower-theatre
pnpm ingest:promote --source=strummers
pnpm ingest:preflight --source=api:visitfresnocounty
```

`--source=` accepts venue keys (`strummers`), candidate sources (`api:milb`, `scrape:…`), or API scrapers (`ticketmaster`, `venunite`). Use **`promote-all`** / **`preflight-all`** for all venues — not `--source=venue-ingest`.

Worker API (internal): `POST /trigger?source=venue-ingest&venue=tower-theatre&force=true&dry_run=true`

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
3. Preflight: `pnpm ingest:preflight --source=<key>`.

Cron runs **`venue-ingest`** only for local venues.

## Venue addresses after ingest

Scrapers should populate `normalized_event.venueAddress`, `venueCity`, and `venueLat`/`venueLng` when the upstream API provides coordinates (see [VENUE_LOCATION.md](VENUE_LOCATION.md) per-source table).

**String cleanup (not geocoding):**

```bash
pnpm db:backfill-addresses --dry-run
pnpm db:backfill-addresses
```

Requires `pnpm ingest:dev`. Also available in admin **Queue maintenance → Venue addresses**.

Coordinates are filled at **admin approve** (`upsertVenue` geocode) or **admin maintenance → Geocode venues**, not during ingest persist for Visit Fresno–style sources.
