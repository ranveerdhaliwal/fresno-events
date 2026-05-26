# Supabase

Schema: `migrations/`. Seed data: `seed.sql` (runs only on **`pnpm db:reset`**, not on `db:migrate`).

## Daily commands

```bash
pnpm db:start          # after reboot — start Docker stack (data usually persists)
pnpm db:migrate:local  # new migration files only — keeps event_candidates, etc.
pnpm db:migrations     # what’s applied locally vs linked cloud
pnpm db:reset          # wipe + all migrations + seed (destructive)
pnpm db:seed:local     # re-run seed.sql without reset
```

Cloud dev: `pnpm db:migrate:cloud-dev` or Supabase MCP — see [docs/DATABASE_ACCESS.md](../docs/DATABASE_ACCESS.md).

Local Studio: http://127.0.0.1:54423 (not 54323 on many WSL setups). Copy local tables to cloud: `pnpm db:push-cloud-dev --confirm`.

Tables: `events`, `event_candidates`, `venues`, `images`, `ingest_runs`, `venue_ingest_state`, `venue_ingest_runs`.

`events.priority` (0–5): set at admin approve time, not during ingest.
