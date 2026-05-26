# Ingest worker

```bash
pnpm ingest:dev
pnpm ingest:preflight-venues
pnpm ingest:promote-venues
```

| Registry key | Role |
|--------------|------|
| `venue-ingest` | All repo venues (crawl + API) — [docs/VENUE_INGEST.md](../../docs/VENUE_INGEST.md) |
| `ticketmaster`, etc. | Third-party APIs |
| `ai-discovery` | Manual civic URL discovery |
