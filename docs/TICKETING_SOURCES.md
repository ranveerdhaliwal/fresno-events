# Ticketing sources (Ticketmaster + VenuNite)

Aggregators live in [`workers/ingest/src/registry.ts`](../workers/ingest/src/registry.ts) — not under `venue-ingest` modules.

## Preflight vs promote

Both sources use the generic preflight/promote flow:

```bash
pnpm ingest:preflight --source=ticketmaster
pnpm ingest:preflight --source=venunite
```

**Preflight shows:** scrape health, validation, raw event count, **within-batch** duplicates (same source, same run), and **+new / ~changed / =unchanged** vs existing rows with the same `source` + `source_event_id`.

**Preflight does not show cross-source dedupe.** That runs only on promote (`ingest:run --force`). After promote, grep ingest logs for `ingest_occurrence_linked` or run `node scripts/report-occurrence-collisions.mjs`.

## Ticketmaster Discovery API

| Item | Value |
| --- | --- |
| Scraper key | `ticketmaster` |
| Source | `ticketmaster` |
| Env | `TICKETMASTER_API_KEY` (Consumer Key only — no Consumer Secret) |
| Cadence | Daily (`defaultCadenceMinutes: 1440`) |
| Signup | [developer.ticketmaster.com](https://developer.ticketmaster.com/) → Discovery API |

**Behavior:** Paginated fetch (`size=200`), Fresno lat/long + radius, `startDateTime` from run time (override via scraper `defaultConfig` later). Logs `Rate-Limit-Available` header; retries once on HTTP 429.

**Pricing:** Discovery no longer returns `priceRanges` (removed March 2025). We do not use Inventory Status API. After ingest, **linked occurrence harmonization** copies `priceMin` / `priceMax` from cross-source siblings (e.g. Big Fresno Fair scrape → Ticketmaster primary). Venue modules with their own ticketing (Tower TicketSauce, fair box office) remain the price source of record.

**Quota:** Discovery free tier is 5k calls/day. A full daily run is ~1–3 pages (~1–3 calls). Far-future window sweeps stay well under budget.

```bash
pnpm ingest:preflight --source=ticketmaster
pnpm ingest:run --source=ticketmaster --force
```

## VenuNite REST API

| Item | Value |
| --- | --- |
| Scraper key | `venunite` |
| Source | `venunite` |
| Env | None (public API) |
| Cadence | Every 14 days (`defaultCadenceMinutes: 20160`) |
| Config | [`workers/ingest/src/scrapers/venunite.config.json`](../workers/ingest/src/scrapers/venunite.config.json) |

**Endpoint:** `https://venunite.com/api/events?state=ca&cities=Fresno&sort=date-asc&includeFilters=false&page=N`

**Overlap policy:** `skipModules` drops rows already covered by direct scrapers:

- `ticketmaster_ca`, `ticketmaster` — Ticketmaster lane
- `fresno_grizzlies` — MiLB venue module
- `strummer_s_bar_grill_fresno` — Strummer's venue module

**URLs:** Maps upstream `website` to `externalUrl` / `ticketUrl` — not VenuNite `/api/tickets/go` affiliate redirects.

**IDs:** Prefers upstream Eventbrite/Ticketmaster IDs from `website` when present (`eb:…`, `tm:…`); otherwise `vu:{id}`.

```bash
pnpm ingest:preflight --source=venunite
pnpm ingest:run --source=venunite --force
```

## Cross-source dedupe

**On by default.** Secondaries from overlapping sources (Visit Fresno, TM, Venunite, etc.) are marked `duplicate` and linked to the primary. To observe matches without hiding admin rows, set `INGEST_CROSS_SOURCE_DEDUPE=false` in `dev-target.env` and re-run `pnpm env:local`.

See [CROSS_SOURCE_DEDUPE.md](CROSS_SOURCE_DEDUPE.md).

## Eventbrite

The legacy `eventbrite` scraper (`manual-only`) uses a deprecated search endpoint. **Do not extend** for org/discover lanes — VenuNite covers Eventbrite-sourced Fresno events via `eventbrite_ca` module rows (with `skipModules` excluding direct-lane overlap only where we have our own scraper).

## Deferred (separate plan)

- Cron **near/far** run profiles (multi-tier ingest windows)
- Downtown BBQ / Save Mart window overrides
- Armenian Heritage Museum venue module (`armof.org`) from VenuNite discovery
