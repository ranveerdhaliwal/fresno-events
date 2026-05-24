# What Up Fresno

A modern events discovery app for Fresno, Clovis, Madera, Kingsburg, Sanger, and the surrounding Central Valley.

## Roadmap / TODO

- [ ] **Now:** Follow [docs/LAUNCH_PLAN.md](docs/LAUNCH_PLAN.md) — Docker + dev DB setup, then implement [docs/INGESTION_OVERHAUL_PLAN.md](docs/INGESTION_OVERHAUL_PLAN.md), ingest into dev DB, UI work.
- [ ] **Later:** Auto-promote approved dev events to prod (API `approve-and-promote` + optional scheduled sync). Until then, prod is updated manually or by re-approving after pointing UI at prod.
- [ ] **Later:** Daily dev ingest cron + refresh/cancel detection for approved events.

## Workspace

- `apps/web` - Vite, React, TanStack Router, Tailwind, PWA shell, `/admin` review console
- `apps/api` - Hono API for Cloudflare Workers (events, review, image streaming)
- `workers/ingest` - Cloudflare Worker with Cron Triggers + manual `POST /trigger` for ingestion sources and AI enrichment
- `packages/shared` - shared TypeScript contracts
- `supabase` - migrations and seed data (`event_candidates`, `ingest_runs`, `events`, …)

## Prerequisites

- **Node.js** 22.12 or newer (Vite 7 and the toolchain expect it). If you use [nvm](https://github.com/nvm-sh/nvm), run `nvm install` from the repo root to pick up [.nvmrc](.nvmrc).
- **pnpm** 10 (see `packageManager` in [package.json](package.json)).
- **Supabase CLI** for the local Postgres/Auth/REST stack when testing real event data.

### Cursor and the same Node as WSL zsh

Cursor can pick up a different `node` than your interactive zsh (for example an editor-bundled binary). This repo includes [.vscode/settings.json](.vscode/settings.json) so the **integrated terminal** and **automation shells** (tasks, Agent terminal commands) use **login + interactive zsh** (`-il`) with `NVM_DIR` set, which usually matches how nvm loads in your normal WSL session.

1. Reload the window after pulling: Command Palette → **Developer: Reload Window**.
2. Command Palette → **Terminal: Select Default Profile** → choose **zsh (nvm)** if it is not already selected.
3. If `zsh` is not at `/usr/bin/zsh` on your distro, edit the `path` in [.vscode/settings.json](.vscode/settings.json) (for example `/bin/zsh`).

If Agent still sees the wrong `node`, ensure nvm runs in Agent-driven shells. Cursor sets `CURSOR_AGENT` in those environments; you can branch in `~/.zshrc` (minimal: `source "$NVM_DIR/nvm.sh"` and `nvm use` when `CURSOR_AGENT` is set) so nvm always applies without slowing every non-Cursor shell.

## Getting Started

```bash
pnpm install
pnpm dev
```

Copy `.env.example` to `apps/web/.env.local` for the Vite app (`VITE_API_URL` should point at the local API, e.g. `http://127.0.0.1:8790`).

For fast UI-only mobile testing, run:

```bash
pnpm dev:web
```

Local dev uses dedicated ports (not Vite’s default `5173`) so other apps can keep `5173` / `8787`. Edit [scripts/dev-ports.env](scripts/dev-ports.env) to change them.

| Service | URL |
| --- | --- |
| Web (Vite) | http://localhost:5182 |
| API (Wrangler) | http://127.0.0.1:8790 (`GET /health` smoke test) |

For local Worker env (Supabase URL, service role, `ADMIN_REVIEW_TOKEN`, `ALLOWED_ORIGIN`), copy [apps/api/.dev.vars.example](apps/api/.dev.vars.example) to `apps/api/.dev.vars` and set `ALLOWED_ORIGIN` to match `scripts/dev-ports.env`. Then `curl -s "http://127.0.0.1:8790/events?from=2026-01-01T00:00:00.000Z&until=2027-01-01T00:00:00.000Z&limit=5"` should return `ok: true` when the database has rows in range.

## Local vs cloud Supabase (`dev-target.env`)

Ingest and the review API both read `SUPABASE_URL` from their `.dev.vars` files. Those must stay in sync. Use one toggle file at the repo root instead of editing URLs by hand.

**Setup (once):**

```bash
cp dev-target.env.example dev-target.env
# Fill SUPABASE_URL_* and SUPABASE_SERVICE_ROLE_KEY_* for local (pnpm db:status) and cloud dev
```

**Switch target** (writes the active URL + service role into `apps/api/.dev.vars` and `workers/ingest/.dev.vars`):

| Command | Database |
| --- | --- |
| `pnpm env:local` | Local Docker Postgres (`pnpm db:start` / `db:reset`) |
| `pnpm env:cloud-dev` | Supabase cloud dev (`what-up-fresno-dev`) |
| `pnpm env:cloud-prod` | Production (use with care) |
| `pnpm env:status` | Show active target and whether `.dev.vars` files match |

After switching, **restart** `pnpm dev:api` and `pnpm ingest:dev` so Wrangler reloads secrets.

**What talks to which DB:**

```text
/admin UI  →  VITE_API_URL (local API :8790)  →  apps/api SUPABASE_URL  →  Postgres
ingest:run / ingest:promote / ingest:enrich  →  workers/ingest SUPABASE_URL  →  same Postgres when env is in sync
```

Local and cloud are **separate sandboxes**. Candidates and events on local do not appear on cloud and vice versa. `pnpm db:reset` only affects local. Cloud may still have rows from earlier runs when you switch to `env:cloud-dev`.

Worker secrets: copy [apps/api/.dev.vars.example](apps/api/.dev.vars.example) and [workers/ingest/.dev.vars.example](workers/ingest/.dev.vars.example) if missing. `ADMIN_REVIEW_TOKEN` must match in both files.

## Database access

**Cloud dev (Cursor agent):** Supabase MCP via OAuth — see [docs/DATABASE_ACCESS.md](docs/DATABASE_ACCESS.md).

**Local Docker:** `pnpm db:start` / `pnpm db:reset` — same doc for connection strings and agent `docker exec` patterns.

## Local Database

The Supabase project in [supabase](supabase) includes the public event schema, seed data, and review staging tables.

```bash
pnpm db:start
pnpm db:reset
```

After reset, the Supabase CLI prints local credentials. Use the `service_role` key for the Worker `.dev.vars`.

| Service | URL | Notes |
| --- | --- | --- |
| Postgres | `postgresql://postgres:postgres@127.0.0.1:54322/postgres` | DBeaver, Beekeeper Studio, TablePlus, `psql` |
| REST API | `http://127.0.0.1:54321` | Used by the Worker via `SUPABASE_URL` |
| Studio | `http://127.0.0.1:54323` | Browser-based table viewer + SQL editor |
| Inbucket | `http://127.0.0.1:54324` | Local email outbox for auth flows |

For DBeaver/Beekeeper, create a Postgres connection with host `127.0.0.1`, port `54322`, database `postgres`, user `postgres`, password `postgres`. The `event_candidates`, `ingest_runs`, `events`, `venues`, and `images` tables live in the `public` schema.

The web app reads through the Worker API when `VITE_API_URL` points at the local API (see `scripts/dev-ports.env`); without it, the UI falls back to mock data.

## Coming Soon Deploy

Cloudflare Pages can serve the minimal holding page while the full app stays available locally:

```bash
VITE_COMING_SOON=true pnpm --filter @fresno-events/web build
```

Use `apps/web/dist` as the Pages output directory and attach the `whatupfresno.com` custom domain. Set `VITE_COMING_SOON=false` or omit it when deploying the full app later.

## Event Review Flow

Ingestion writes API/scraped results into `event_candidates` with `pending_review` status. Public users only see rows approved into `events`.

Protected review endpoints live under `/review` on the API worker and require `ADMIN_REVIEW_TOKEN` as a Bearer token or `x-admin-token` header:

- `GET /review/candidates`
- `GET /review/candidates/:id`
- `POST /review/candidates/:id/approve` - upserts the venue and event, mirrors the hero image into the R2 `EVENT_IMAGES` bucket, and writes a row in `images` with `events.hero_image_id`
- `POST /review/candidates/:id/reject`

Approved images are streamed at `GET /images/<storage_key>` until you point a CDN-fronted custom domain at the bucket via `R2_PUBLIC_BASE_URL`.

The web app exposes the review console at [/admin](http://localhost:5182/admin). Paste the `ADMIN_REVIEW_TOKEN` to unlock the queue. Edits use Pacific date/time fields (empty time = all-day). The list is grouped by display priority (AI `suggested_priority` when enriched, overridable in the form) then confidence. Approve sends a partial `event` payload plus `priority` for the published row.

## Data ingestion

**End-to-end flow (local or cloud — same steps, different DB):**

```text
ingest:promote (or ingest:run)  →  event_candidates (pending_review)
ingest:enrich                   →  confidence, suggested_priority, category/tags (AI)
/admin approve                  →  events (+ venues, images) in the same database
```

Prod is separate: approving on cloud dev does not publish to production until you have a prod promotion path (see roadmap).

More detail: **[docs/INGEST.md](docs/INGEST.md)**, **[docs/INGEST_TESTING.md](docs/INGEST_TESTING.md)**. Scraper registry: [`workers/ingest/src/registry.ts`](workers/ingest/src/registry.ts).

### Prerequisite

```bash
pnpm env:local          # or pnpm env:cloud-dev
pnpm ingest:dev         # terminal 1 — worker on http://127.0.0.1:8788
pnpm dev:api            # terminal 2 — for /admin (or pnpm dev)
```

### Preflight vs promote

| | **Preflight** | **Promote** |
| --- | --- | --- |
| Command | `pnpm ingest:preflight --source=<key>` | `pnpm ingest:promote --source=<key>` |
| Writes DB? | **No** — dry-run only | **Yes** — persists candidates |
| Purpose | “Will this source work? How many events? Validation OK?” | Safe path to real ingest: preflight first, then real run |
| Fails when | Scraper/validation hard errors (dupes, missing fields, …) | Same on preflight step; stops before DB write |

`ingest:promote` options:

- `--skip-preflight` — real run only (you already trust the source)
- `--no-enrich` — skip background enrichment; run `pnpm ingest:enrich` yourself later

### Ingest commands

| Command | What it does |
| --- | --- |
| `pnpm ingest:dev` | Start local ingest worker (port 8788) |
| `pnpm ingest:preflight --source=<key>` | Dry-run one or comma-separated sources; exit 1 if validation fails |
| `pnpm ingest:preflight --all` | Dry-run every runnable scraper (needs API keys) |
| `pnpm ingest:preflight-apis` | Preflight Gate B APIs: visit-fresno, downtown-fresno, milb, seed-special-url |
| `pnpm ingest:promote --source=<key>` | Preflight then **real** persist (+ enrichment unless `--no-enrich`) |
| `pnpm ingest:promote --all` | Preflight + promote all runnable sources |
| `pnpm ingest:run` | Lower-level `POST /trigger` (see flags below) |
| `pnpm ingest:enrich` | AI enrichment on existing `pending_review` rows (`suggested_priority`, confidence, …) |

**`ingest:run` flags:**

- `--source=<key>` — scraper key, comma list, or `--all`
- `--force` — run even if not “due” on the schedule
- `--dry-run` — no DB writes (same idea as preflight)
- `--no-enrich` — after a real run, skip background enrichment
- `--resume-jobs` — ai-crawl resume (not with `--dry-run`)

**`ingest:enrich` flags:**

- `--dry-run` — log patches only, no DB update
- `--source=api:visitfresnocounty` — filter by DB `event_candidates.source` (not scraper key)
- `--limit=N` — max rows per request (default 25; max 100 per API call)
- `--all` — loop batches until no pending rows are left without `[ai]` review notes (default batch size 100; use `--limit=50` for smaller batches)

For **100+ pending** candidates after promote: `pnpm ingest:enrich --all` (runs multiple batches automatically), or `pnpm ingest:enrich --limit=100` repeatedly until `processed` is 0.

### Scraper keys (`--source=` for preflight / promote / run)

| Scraper key | Typical `event_candidates.source` | Notes |
| --- | --- | --- |
| `visit-fresno-api` | `api:visitfresnocounty` | ~224 events typical |
| `downtown-fresno-api` | `api:downtownfresno` | ~27 |
| `milb-api` | `api:milb` | ~88 |
| `seed-special-url` | varies | e.g. gobulldogs (often 0) |
| `ticketmaster`, `seatgeek`, `eventbrite`, `bandsintown` | per provider | Needs API keys in `workers/ingest/.dev.vars` |
| `ai-discovery`, `ai-crawl` | crawl lanes | BR + LLM keys |

### Recommended workflow (one source, local)

```bash
pnpm env:local
pnpm ingest:dev
pnpm ingest:preflight --source=visit-fresno-api
pnpm ingest:promote --source=visit-fresno-api
pnpm ingest:enrich --limit=50          # if you used --no-enrich on promote
pnpm dev:api                           # open http://127.0.0.1:5182/admin
```

Check data in Studio (http://127.0.0.1:54323 when on local). For cloud dev, use `pnpm env:cloud-dev`, restart workers, run the same ingest commands, and use the Supabase dashboard or MCP — local Studio will not show cloud rows.

Validation can be bypassed in an emergency with `INGEST_SKIP_VALIDATION=true` in `workers/ingest/.dev.vars` (logged; avoid for normal use).

## Scripts

**Dev stack**

- `pnpm dev` — web + API in parallel (ports in [scripts/dev-ports.env](scripts/dev-ports.env))
- `pnpm dev:web` — Vite only
- `pnpm dev:api` — API worker only
- `pnpm dev:web:local-api` — Vite → local API :8790
- `pnpm dev:web:cloud-dev` / `dev:web:cloud-prod` — Vite → deployed API (`.env.cloud-targets`)

**Supabase target**

- `pnpm env:local` / `pnpm env:cloud-dev` / `pnpm env:cloud-prod` — sync URL + key to API + ingest `.dev.vars`
- `pnpm env:status` — show active target

**Database**

- `pnpm db:start` / `pnpm db:stop` / `pnpm db:reset` / `pnpm db:status` — local Supabase CLI

**Ingest** (see [Data ingestion](#data-ingestion))

- `pnpm ingest:dev`
- `pnpm ingest:preflight --source=<key>` / `--all`
- `pnpm ingest:preflight-apis`
- `pnpm ingest:promote --source=<key>` / `--all` [`--skip-preflight`] [`--no-enrich`]
- `pnpm ingest:run [--source=...] [--force] [--dry-run] [--no-enrich]`
- `pnpm ingest:enrich [--dry-run] [--source=api:...] [--limit=N]`
- `pnpm --filter @fresno-events/ingest deploy` — deploy ingest worker (cron from `wrangler.toml`)

**Build**

- `pnpm typecheck` / `pnpm build`

For the cloud target scripts, create `.env.cloud-targets` (gitignored) at the repo root:

```
VITE_API_URL_DEV=https://fresno-events-api-dev.<account>.workers.dev
VITE_API_URL_PROD=https://api.whatupfresno.com
```

## Observability

Both the API worker and the ingest worker enable Workers Observability (`[observability] enabled = true`). After deploy you can:

- `wrangler tail fresno-events-api` and `wrangler tail fresno-events-ingest` for live structured logs.
- View per-cron dashboards in the Cloudflare Workers UI for `fresno-events-ingest`.

The ingest worker emits structured JSON log events including `ingest_run` (per source), `ai_enrichment`, `image_mirror_failed` (from the API worker), `source_budget_exceeded`, and `record_source_run_failed`. Per-run budgets are controlled by `MAX_SOURCES_PER_RUN` and `MAX_ENRICH_PER_RUN` (env vars; defaults `8` and `25`).

For the frontend, set `VITE_SENTRY_DSN` to enable error tracking. The web app already imports `@sentry/react`; wire `Sentry.init({ dsn: import.meta.env.VITE_SENTRY_DSN })` in `apps/web/src/main.tsx` before deploying to production.

## Cloud Deploy

**Order:** [docs/LAUNCH_PLAN.md](docs/LAUNCH_PLAN.md) (setup + build path) → [docs/INGESTION_OVERHAUL_PLAN.md](docs/INGESTION_OVERHAUL_PLAN.md) (ingest implementation spec).

Prod does **not** run ingest or scrape cron. Events reach production only after you promote them from dev (automation is on the roadmap above).

## Design Gate

Before building production event cards, calendar rows, map sheets, or detail pages, review Luma, Partiful, Dice, and Resy in-browser and iterate with mock data until the Fresno Events components feel like a polished 2026 product.
