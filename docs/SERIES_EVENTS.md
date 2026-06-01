# Series events

Operator summary for recurring shows, multi-day festivals, and duplicate CMS listings.

**Full plan:** [SERIES_EVENTS_PLAN.md](SERIES_EVENTS_PLAN.md)

## Three layers

| Layer | What | Example |
|-------|------|---------|
| 1. Batch dedupe | Collapse same-night duplicate listings in one scrape | Backyard 101 vs Backyard101 on 6/2 |
| 2. Series identity | Canonical `seriesId` on recurring rows | All Tuesday trivia nights share one id |
| 3. Series product | Admin siblings, API filter, public detail | “More in this series” on event page |

## Canonical `seriesId`

- Shape: `series:{venueScope}:{sha256}`
- Auto-assigned when `seriesName` matches a recurrence pattern (`Recurring weekly on Tuesday`, etc.)
- Anchor: normalized title + venue (handles title drift and duplicate CMS slugs)
- Explicit ids from `venue.config.json` (e.g. Big Fresno Fair) are preserved as-is

## Verify

```bash
pnpm ingest:dev
pnpm ingest:preflight --venue=visit-fresno-county
```

Pass criteria:

- Preflight summary shows `−N batch duplicate(s) removed` when duplicates exist
- ~239 events (not 243) for Visit Fresno
- Recurring rows have `seriesId` matching `/^series:visitfresnocounty:[a-f0-9]{64}$/`

## Admin

Open a recurring candidate in `/admin`. The **Series** block shows `seriesName`, canonical `seriesId`, and pending siblings (other dates in the queue).

## API

- List: `GET /events?series_id={canonicalId}&from=...`
- Detail: `seriesEvents` array (upcoming siblings, max 20)
