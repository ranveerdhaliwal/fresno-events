# Cross-source event dedupe

Same real-world events from Visit Fresno, Downtown Fresno, venue scrapers, and MiLB share one **`occurrence_id`** in Postgres. Each ingest source still has its own `event_candidates` row (`source`, `source_event_id`, URLs).

## Columns

| Column | Role |
|--------|------|
| `occurrence_id` | Link column — all sources for one show |
| `occurrence_key` | Finder: canonical title + Pacific 30m bucket (±1) + venue (see matching rules below) |
| `url_key` | Finder: normalized ticket/external URL |
| `canonical_candidate_id` | Non-primary → primary in the New queue |

## Ingest

1. Always compute `occurrence_id` + finder keys on persist.
2. Match step A (`occurrence_key`), then B (`url_key`), else new group.
3. **Default: linking enabled.** Set `INGEST_CROSS_SOURCE_DEDUPE=false` to shadow mode (keys assigned; logs `ingest_occurrence_would_link` without status changes).
4. When enabled:
   - Secondaries: `status=duplicate`, `canonical_candidate_id` → primary.
   - If a **scheduled** `events` row exists: `matched_event_id` auto-link (no second approval).

### Matching rules (`packages/shared/src/occurrence.ts`)

- **Venue aliases** — e.g. Strummer's → Strummers scrape slug, Warnors Center → Warnors Theatre, Saroyan name variants, Save Mart sub-names.
- **Title canonicalization (occurrence only)** — Promo-night Grizzlies titles collapse to `fresno grizzlies vs {opponent}`; strips trailing `- Fresno` / `Live In Concert` / `Tour` / calendar year before hashing. Miss California week listings (`Competition Week`, `2026`, etc.) collapse to `miss california` or `miss california teen`. Display titles are unchanged.
- **Fuzzy title match (step C)** — When step A/B miss, same normalized venue + Pacific show date + high significant-word overlap (`packages/shared/src/title-similarity.utils.ts`) can link rows (e.g. Lil Wayne Ticketmaster vs Venunite tour wording, or short headliners like `ZZ Top` vs `ZZ Top Tour`). Admin shows lower-threshold near-matches that are not yet linked.
- **URL keys** — Ticketmaster `/event/{id}` and Eventbrite numeric event IDs normalize to stable `url_key` (helps Venunite `eb:` rows and TM overlap).
- **Primary source order** — When linking duplicates, **Ticketmaster** is preferred over scrapers and Visit/Downtown APIs (approved / already-published rows still win when they carry `matched_event_id`).
- **Series URLs** — Shared listing URLs (multi-night runs) only link when **occurrence buckets overlap** (same show time). A week-long Visit page URL will not merge Jun 16 and Jun 17 into one occurrence.
- **Occurrence IDs on relink** — `pnpm ingest:relink` assigns a stable UUID per `occurrence_key` (one per show night). Published Visit rows beat Ticketmaster when both have `matched_event_id`.

After changing matching rules, re-promote affected sources so existing rows recompute keys, then run a full relink:

```bash
pnpm ingest:promote --source=ticketmaster
pnpm ingest:relink
```

**Re-promote alone is not enough** — rows that already have an `occurrence_id` skip cross-source lookup on re-ingest. `pnpm ingest:relink` recomputes keys and duplicate links for all candidates (or `--source=` scoped).

```bash
pnpm ingest:relink --dry-run    # preview counts, no writes
pnpm ingest:relink              # apply (requires pnpm ingest:dev)
pnpm ingest:relink --source=ticketmaster
```

## Admin

- **New** tab: `canonical_candidate_id is null` (primaries only).
- **Updates** tab: same — linked secondaries stay `duplicate` when their source changes; only the primary can surface `needs_changes`.
- Detail: **Also listed on** lists siblings with the same `occurrence_id`.
- Detail: **Possibly the same show** (amber) lists same venue/night rows with high title word overlap that are not yet duplicates.
- Approve the primary; siblings get `matched_event_id`. `source_refs.alternates` updated on approve.

## Disable linking (shadow mode)

```bash
# In .dev.vars / wrangler secret — only when debugging matcher false positives
INGEST_CROSS_SOURCE_DEDUPE=false
```

## Backfill / collisions

```bash
node scripts/report-occurrence-collisions.mjs
```

Run after migration. Resolve duplicate scheduled `events` sharing an `occurrence_id` before adding:

```sql
create unique index events_occurrence_id_scheduled_unique
  on public.events (occurrence_id)
  where status = 'scheduled' and occurrence_id is not null;
```

### Published orphan cleanup

When sources were bulk-approved in different orders, candidate dedupe may be correct while **two scheduled `events` rows** remain (stale `occurrence_id` on the older publish). Admin API:

```http
POST /review/ops/published-orphan-cleanup?dry_run=true
POST /review/ops/published-orphan-cleanup
```

Keeps the row duplicate candidates vote for (or venue scraper over Ticketmaster). Approve also patches an existing scheduled row when **content signature** (title + venue + start) matches, even if `occurrence_id` differs.

Pre-approve audit flags `published_content_duplicate` when a pending primary would collide with an existing scheduled show on a different `occurrence_id`.

## Examples

- **Same title/time/venue** across Visit + Downtown → one primary, one duplicate (step A).
- **Same Eventbrite URL**, different titles → step B.
- **Grizzlies** with divergent titles and no shared URL → may stay separate until URL overlap or manual review.
