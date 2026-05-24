# Ingest worker

Cloudflare Worker: cron + `POST /trigger` → scrapers → `event_candidates` → optional LLM enrichment.

## Local dev

```bash
pnpm ingest:dev          # :8788
pnpm ingest:run --source=ai-crawl --dry-run --force
```

Env: `workers/ingest/.dev.vars` (see `.dev.vars.example`).

## Sources

| Key | Notes |
|-----|--------|
| `ticketmaster` | API key |
| `ai-discovery` | Legacy HTML fetch (soft cutover) |
| `ai-crawl` | Browser Rendering + markdown LLM ([docs/AI_CRAWLER.md](../../docs/AI_CRAWLER.md)) |

## Flags

`scripts/ingest-run.sh`: `--source`, `--force`, `--dry-run`, `--resume-jobs` (mutually exclusive with dry-run).
