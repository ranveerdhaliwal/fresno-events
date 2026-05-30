# Cross-source event dedupe

Same real-world events from Visit Fresno, Downtown Fresno, venue scrapers, and MiLB share one **`occurrence_id`** in Postgres. Each ingest source still has its own `event_candidates` row (`source`, `source_event_id`, URLs).

## Columns

| Column | Role |
|--------|------|
| `occurrence_id` | Link column — all sources for one show |
| `occurrence_key` | Finder: normalized title + Pacific 30m bucket (±1) + venue |
| `url_key` | Finder: normalized ticket/external URL |
| `canonical_candidate_id` | Non-primary → primary in the New queue |

## Ingest

1. Always compute `occurrence_id` + finder keys on persist.
2. Match step A (`occurrence_key`), then B (`url_key`), else new group.
3. With **`INGEST_CROSS_SOURCE_DEDUPE=true`** (or `1`):
   - Secondaries: `status=duplicate`, `canonical_candidate_id` → primary.
   - If a **scheduled** `events` row exists: `matched_event_id` auto-link (no second approval).
4. With flag off: keys still assigned; logs `ingest_occurrence_would_link` without status changes.

## Admin

- **New** tab: `canonical_candidate_id is null` (primaries only).
- Detail: **Also listed on** lists siblings with the same `occurrence_id`.
- Approve the primary; siblings get `matched_event_id`. `source_refs.alternates` updated on approve.

## Enable linking

```bash
# In .dev.vars / wrangler secret
INGEST_CROSS_SOURCE_DEDUPE=true
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

## Examples

- **Same title/time/venue** across Visit + Downtown → one primary, one duplicate (step A).
- **Same Eventbrite URL**, different titles → step B.
- **Grizzlies** with divergent titles and no shared URL → may stay separate until URL overlap or manual review.
