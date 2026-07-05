# What Up Fresno

A modern events discovery app for Fresno, Clovis, Madera, Kingsburg, Sanger, and the surrounding Central Valley.

## Roadmap / remaining work

Operational docs (not historical plans):

| Topic | Doc |
| --- | --- |
| Ingest flow, sources, local vs cloud | [docs/INGEST.md](docs/INGEST.md) |
| Safe promote / preflight / cleanup | [docs/INGEST_TESTING.md](docs/INGEST_TESTING.md) |
| Mon/Thu cron | [docs/INGEST_SCHEDULE.md](docs/INGEST_SCHEDULE.md) |
| CI, deploy, prod checklist | [docs/CI_CD.md](docs/CI_CD.md) |
| Local ↔ cloud DB sync | [docs/DATABASE_ACCESS.md](docs/DATABASE_ACCESS.md) |

**Still open (as of June 2026):**

- [ ] Merge CI + Workers deploy fixes to `main`; confirm `deploy-workers` green after merge
- [ ] Verify Mon/Thu ingest cron on cloud after subrequest-budget deploy
- [ ] GA / AdSense verification on `whatupfresno.com` (slots still manual)
- [ ] Optional: Workers Paid plan if full TM dedupe + published-event sync needed on every run (compact mode skips some work at 40+ events)
- [ ] Later: auto-promote approved dev → prod DB; daily refresh/cancel detection for approved events

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

For local Worker env, use repo-root `dev-target.env` (see below). Then `curl -s "http://127.0.0.1:8790/events?from=2026-01-01T00:00:00.000Z&until=2027-01-01T00:00:00.000Z&limit=5"` should return `ok: true` when the database has rows in range.

## Local vs cloud Supabase (`dev-target.env`)

**One file for all local dev secrets:** `dev-target.env`. `apps/api/.dev.vars` and `workers/ingest/.dev.vars` are auto-generated — do not edit them by hand.

**Setup (once):**

```bash
cp dev-target.env.example dev-target.env
# Fill Supabase keys, ADMIN_REVIEW_TOKEN, ALLOWED_ORIGINS, ingest API keys (see example file)
pnpm env:local   # or env:cloud-dev — regenerates both .dev.vars
```

**Switch target** (regenerates `apps/api/.dev.vars` and `workers/ingest/.dev.vars` from `dev-target.env`):

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

Worker secrets: set everything in `dev-target.env`, then `pnpm env:<target>`. First run backfills missing keys from existing `.dev.vars` if you migrated from the old layout.

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
| Studio | `http://127.0.0.1:54423` | Browser-based table viewer + SQL editor (`supabase status` for actual port) |
| Inbucket | `http://127.0.0.1:54324` | Local email outbox for auth flows |

For DBeaver/Beekeeper, create a Postgres connection with host `127.0.0.1`, port `54322`, database `postgres`, user `postgres`, password `postgres`. The `event_candidates`, `ingest_runs`, `events`, `venues`, and `images` tables live in the `public` schema.

The web app reads through the Worker API when `VITE_API_URL` points at the local API (see `scripts/dev-ports.env`); without it, the UI falls back to mock data.

## Production web deploy (Cloudflare Pages)

Build with the prod API URL and Google keys from `dev-target.env`:

```bash
VITE_API_URL=https://api.whatupfresno.com \
VITE_GA_MEASUREMENT_ID=G-SP3QWX0EGP \
VITE_ADSENSE_CLIENT_ID=ca-pub-1385262226884616 \
pnpm --filter @fresno-events/web build
```

Set the same `VITE_*` variables in **Cloudflare Pages → Settings → Environment variables → Production** (plus `VITE_ADSENSE_SLOT_*` when ad units are created). Deploy `apps/web/dist` and attach `whatupfresno.com`.

Local dev keeps GA/ads off unless you copy those vars into `apps/web/.env.local` and restart the dev server.

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
ingest:relink                   →  occurrence keys + cross-source duplicate links (after promote)
published-orphan-cleanup        →  drop duplicate scheduled events (after relink, before approve)
/admin approve                  →  events (+ venues, images) in the same database
```

Prod is separate: approving on cloud dev does not publish to production until you have a prod promotion path (see roadmap).

More detail: **[docs/INGEST.md](docs/INGEST.md)**, **[docs/INGEST_TESTING.md](docs/INGEST_TESTING.md)**, **[docs/INGEST_LOCAL_OPS.md](docs/INGEST_LOCAL_OPS.md)** (full Mon/Thu pipeline including relink + orphan cleanup). Scraper registry: [`workers/ingest/src/registry.ts`](workers/ingest/src/registry.ts).

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
| `pnpm ingest:preflight-all` | Dry-run all enabled venue sources |
| `pnpm ingest:promote-all` | Real persist — all venue sources |
| `pnpm ingest:preflight --source=<key>` | Dry-run one source |
| `pnpm ingest:promote --source=<key>` | Real persist one source |
| `pnpm ingest:run` | Lower-level `POST /trigger` (see flags below) |
| `pnpm ingest:enrich` | AI enrichment on existing `pending_review` rows |

**`ingest:run` flags:**

- `--source=<key>` — resolved scraper key (usually via `ingest:promote`)
- `--force` — run even if not “due” on the schedule
- `--dry-run` — no DB writes (same idea as preflight)
- `--no-enrich` — after a real run, skip background enrichment

**`ingest:enrich` flags:**

- `--dry-run` — log patches only, no DB update
- `--source=api:visitfresnocounty` — filter by DB `event_candidates.source`
- `--limit=N` — max rows per request (default 25; max 100 per API call)
- `--all` — loop batches until no pending rows are left without `[ai]` review notes (default batch size 100; use `--limit=50` for smaller batches)

For **100+ pending** candidates after promote: `pnpm ingest:enrich --all` (runs multiple batches automatically), or `pnpm ingest:enrich --limit=100` repeatedly until `processed` is 0.

### Sources (`--source=`)

| `--source=` | Notes |
| --- | --- |
| `pnpm ingest:promote-all` | All 12 venue modules — see [VENUE_INGEST.md](docs/VENUE_INGEST.md) |
| `ticketmaster` | Needs `TICKETMASTER_API_KEY` |
| `venunite` | Public API, no key |
| `strummers`, `save-mart`, … | Venue key (same as module folder) |
| `api:visitfresnocounty`, `api:milb`, … | Candidate source value from admin |

### Recommended workflow (local)

```bash
pnpm env:local
pnpm ingest:dev
pnpm ingest:preflight-all && pnpm ingest:promote-all
pnpm ingest:preflight --source=ticketmaster && pnpm ingest:promote --source=ticketmaster
pnpm ingest:enrich --limit=50
pnpm ingest:relink --dry-run && pnpm ingest:relink    # after promote — see INGEST_LOCAL_OPS.md
pnpm dev:api                                           # orphan cleanup + http://127.0.0.1:5182/admin
```

Full promote job (Mon/Thu, cloud-dev, detail-backfill, enrich, relink, orphan cleanup): **[docs/INGEST_LOCAL_OPS.md](docs/INGEST_LOCAL_OPS.md)**.

Check data in Studio (http://127.0.0.1:54423 when on local — run `supabase status` if the port changed). For cloud dev, use `pnpm env:cloud-dev`, restart workers, run the same ingest commands, and use the Supabase dashboard or MCP — local Studio will not show cloud rows.

Validation can be bypassed in an emergency with `INGEST_SKIP_VALIDATION=true` in `workers/ingest/.dev.vars` (logged; avoid for normal use).

## Scripts

**Dev stack**

- `pnpm dev` — web + API in parallel (ports in [scripts/dev-ports.env](scripts/dev-ports.env))
- `pnpm dev:web` — Vite only
- `pnpm dev:api` — API worker only
- `pnpm dev:web:local-api` — Vite → local API :8790
- `pnpm dev:web:cloud-dev` / `dev:web:cloud-prod` — Vite → deployed API (`.env.cloud-targets`)

**Supabase target**

- `pnpm env:local` / `pnpm env:cloud-dev` / `pnpm env:cloud-prod` — regenerate API + ingest `.dev.vars` from `dev-target.env`
- `pnpm env:status` — show active target

**Database**

- `pnpm db:start` / `pnpm db:stop` / `pnpm db:reset` / `pnpm db:status` — local Supabase CLI

**Ingest** (see [Data ingestion](#data-ingestion))

- `pnpm ingest:dev`
- `pnpm ingest:preflight-all` / `pnpm ingest:promote-all`
- `pnpm ingest:preflight --source=<key>` / `pnpm ingest:promote --source=<key>`
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

Live stack: **Cloudflare Pages + API/ingest Workers** on the `dev` wrangler profile, **single cloud-dev Supabase** (`what-up-fresno-dev`). See [docs/CI_CD.md](docs/CI_CD.md) for deploy flow and remaining checklist items.

Prod does **not** run a separate ingest DB or promotion step for v1 — ingest, review, and the public site share cloud-dev.

## Design Gate

Before building production event cards, calendar rows, map sheets, or detail pages, review Luma, Partiful, Dice, and Resy in-browser and iterate with mock data until the Fresno Events components feel like a polished 2026 product.
