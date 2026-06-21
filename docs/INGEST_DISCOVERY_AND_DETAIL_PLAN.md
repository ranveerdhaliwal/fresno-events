# Ingest — implementation backlog

**Target flow (per venue):**

```text
venue run (listing + detail in one pass)
  → persist candidates
  → post-ingest AI enrichment
  → pending_review (admin can review)
```

No separate “events job” vs “details job” across venues. No `ingesting` status in the product model—rows simply are not review-ready until enrichment finishes.

**Already done:** Direct lane without BR on Downtown; `ingest:*-direct` / `ingest:*-browser`; BR `depth: 1`; gobulldogs on browser lane; scrape logging. See git history / [VENUE_INGEST.md](VENUE_INGEST.md) for commands.

**Related:** [INGEST_TESTING.md](INGEST_TESTING.md)

---

## 1. Review queue only after enrichment

**Done:** New rows persist as `awaiting_enrichment`; enrichment promotes to `pending_review`. Venue-ingest runs persist → enrich per venue in one promote ([`persist-and-enrich-venue.ts`](../workers/ingest/src/candidates/persist-and-enrich-venue.ts)). Admin still lists `pending_review` only.

| Task | Notes |
|------|--------|
| [x] Insert as `awaiting_enrichment`, enrich, then `pending_review` | Migration `20260529120000_awaiting_enrichment_status.sql` |
| [x] Per-venue persist + enrich in venue-ingest promote | Skips global persist/enrich when `metrics.venuePersistPerVenue` |
| [x] Admin/API default status `pending_review` | `awaiting_enrichment` never shown in New tab |

---

## 2. Per-venue scrape behavior (one `run.ts` each)

Each venue config describes **listing + detail in a single run**. Shared helpers ([`listing-detail.run.ts`](../workers/ingest/src/venues/_shared/listing-detail.run.ts)) are optional; venue module owns the recipe.

**Default pattern for JS listings:** plain listing fetch → if no URLs, shallow BR on listing → plain HTTP on each detail URL on allowed hosts → `br_llm` only if profile requires.

| Venue | Listing (target) | Detail (target) | Other |
|-------|------------------|-----------------|-------|
| `visit-fresno-county` | API | Descriptions in API payload | direct lane |
| `milb-grizzlies` | API | Schedule fields only | direct lane |
| `downtown-fresno` | BBQ widget | Plain HTTP `/do/...` pages | direct lane; no BR |
| `strummers` | Plain HTML | Plain HTML show pages | no BR on detail |
| `fulton-55` | Plain HTML | **Listing-only** — use card copy | **Remove Eventbrite** from `allowedExternalHosts` |
| `fresno-convention-center` | Plain or BR if empty | Plain HTML on convention host | |
| `chaffee-zoo` | Plain HTML | Plain HTML on `fcz.org` events | ticketapp = ticket URL only, not full crawl |
| `tower-theatre` | Plain or BR | Plain on TicketSauce if SSR; else `br_llm` | same host |
| `rainbow-ballroom` | Plain or BR | Plain on eventmania if linked | |
| `save-mart` | BR month windows | Plain HTML `/event/...` when SSR | |
| `big-fresno-fair` | BR scroll listing | Plain HTML `/events/...` when SSR | |
| `gobulldogs` | BR print calendar | `br_llm` if SPA | browser lane |

| Task | Notes |
|------|--------|
| [x] Venue profile fields: `listingDiscovery`, `detailMode`, `blockedDetailHosts` | [`venue.types.ts`](../workers/ingest/src/venues/venue.types.ts) |
| [x] Detail step branches on `detailMode` | `plain_html` / `br_llm` / `none` in [`listing-detail.utils.ts`](../workers/ingest/src/venues/_shared/listing-detail.utils.ts) |
| [x] **Fulton:** `detailMode: none`, Eventbrite blocked | No Eventbrite in `allowedExternalHosts` |
| [x] **Downtown:** plain HTTP `/do/...` detail | [`downtown-fresno-api.utils.ts`](../workers/ingest/src/scrapers/downtown-fresno-api.utils.ts) |
| [x] **Strummers:** `detailMode: plain_html` | |
| [x] Blocked hosts skipped for detail fetch | `blockedDetailHosts` + `isDetailHostBlocked` |

---

## 3. Orchestration (venue-ingest)

| Task | Notes |
|------|--------|
| [x] Per venue: `run` → persist → enrich → `pending_review` | [`venue-ingest.ts`](../workers/ingest/src/scrapers/venue-ingest.ts) |
| [x] Preflight stays dry-run / plan-only | Unchanged |
| [ ] Document expected promote duration per lane in [VENUE_INGEST.md](VENUE_INGEST.md) | Browser lane can be long |

---

## 4. Tests & docs

| Task | Notes |
|------|--------|
| [ ] Tests for plain-html detail parser, Fulton host filter, enrich-then-review gate | |
| [ ] Trim [INGEST_TESTING.md](INGEST_TESTING.md) link text if it still describes old 3-job model | |

---

## 5. Per-venue test commands (Phase A)

**Prerequisite:** In a separate terminal, start the ingest worker:

```bash
pnpm ingest:dev
```

For each venue: **preflight** (dry-run plan, no DB writes), then **promote** (real persist + enrich). Use cloud dev or local per `dev-target.env`.

### Direct lane (API / plain HTML, no Browser Rendering on promote)

```bash
pnpm ingest:preflight --source=visitfresnocounty && pnpm ingest:promote --source=visitfresnocounty
pnpm ingest:preflight --source=downtownfresno && pnpm ingest:promote --source=downtownfresno
pnpm ingest:preflight --source=milb && pnpm ingest:promote --source=milb
```

### Browser lane (listing/detail may use BR + LLM where configured)

```bash
pnpm ingest:preflight --source=strummers && pnpm ingest:promote --source=strummers
pnpm ingest:preflight --source=fulton55 && pnpm ingest:promote --source=fulton55
pnpm ingest:preflight --source=fresnoconventioncenter && pnpm ingest:promote --source=fresnoconventioncenter
pnpm ingest:preflight --source=chaffeezoo && pnpm ingest:promote --source=chaffeezoo
pnpm ingest:preflight --source=towertheatre && pnpm ingest:promote --source=towertheatre
pnpm ingest:preflight --source=rainbowballroom && pnpm ingest:promote --source=rainbowballroom
pnpm ingest:preflight --source=savemart && pnpm ingest:promote --source=savemart
pnpm ingest:preflight --source=fresnofair && pnpm ingest:promote --source=fresnofair
pnpm ingest:preflight --source=gobulldogs && pnpm ingest:promote --source=gobulldogs
```

### Verify after promote

1. **Admin** `/admin` → **New** — only `pending_review` rows (not `awaiting_enrichment`).
2. **SQL** (cloud dev MCP or local `psql`):  
   `SELECT status, source, count(*) FROM event_candidates WHERE source LIKE '%visit%' OR source LIKE 'scrape:%' GROUP BY 1, 2;`

### Lane batch smoke (optional)

```bash
pnpm ingest:preflight-direct && pnpm ingest:promote-direct
pnpm ingest:preflight-browser && pnpm ingest:promote-browser
```

---

## Out of scope

- `ingesting` as a user-facing status
- Global “all venues listing, then all venues detail” orchestration
- BR on **direct** lane (Visit, Downtown, MiLB)
- Crawling Eventbrite (or similar) as detail pages
- Deferring detail to a second cron / background job after promote returns

---

*Last updated: May 2026*
