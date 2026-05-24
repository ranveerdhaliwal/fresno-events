# Supabase

Schema: `migrations/`. Seed data: `seed.sql`.

```bash
pnpm db:start
pnpm db:reset      # migrations + seed
pnpm db:seed:local # re-apply seed only
pnpm db:seed       # cloud linked project
supabase db push   # apply migrations to linked cloud dev
```

Tables: `events`, `event_candidates`, `venues`, `images`, `ingest_runs`, `seed_urls`.

`events.priority` (0–5): set at admin approve time, not during ingest.
