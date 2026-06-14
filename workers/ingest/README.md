# Ingest worker

```bash
pnpm ingest:dev
pnpm ingest:preflight-all
pnpm ingest:promote-all
pnpm ingest:preflight --source=strummers
pnpm ingest:promote --source=ticketmaster
```

## Sources

| `--source=` | Role |
| --- | --- |
| `pnpm ingest:promote-all` | All 12 venue modules — [docs/VENUE_INGEST.md](../../docs/VENUE_INGEST.md) |
| `ticketmaster` | Ticketmaster Discovery API — [docs/TICKETING_SOURCES.md](../../docs/TICKETING_SOURCES.md) |
| `venunite` | VenuNite Fresno aggregator — [docs/TICKETING_SOURCES.md](../../docs/TICKETING_SOURCES.md) |
| venue key or `api:…` / `scrape:…` | One venue module (same names as `event_candidates.source` in admin) |

New venues: add a module under `src/venues/<key>/` (explicit `venue.config.json` + `run.ts`). No generic AI URL discovery.
