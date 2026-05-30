# Ingest worker

```bash
pnpm ingest:dev
pnpm ingest:preflight-direct    # API + html_parse
pnpm ingest:preflight-browser   # Browser Rendering crawlers
pnpm ingest:preflight-all       # both lanes
pnpm ingest:promote-direct
pnpm ingest:promote-browser
pnpm ingest:promote-all
```

| Registry key | Role |
|--------------|------|
| `venue-ingest` | All repo venues (direct + browser lanes) — [docs/VENUE_INGEST.md](../../docs/VENUE_INGEST.md) |
| `ticketmaster`, etc. | Third-party APIs |
| `ai-discovery` | Manual civic URL discovery |
