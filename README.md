# What Up Fresno

A modern events discovery app for Fresno, Clovis, Madera, Kingsburg, Sanger, and the surrounding Central Valley.

## Workspace

- `apps/web` - Vite, React, TanStack Router, Tailwind, PWA shell, `/admin` review console
- `apps/api` - Hono API for Cloudflare Workers (events, review, image streaming)
- `workers/ingest` - Cloudflare Worker with Cron Triggers + manual `POST /trigger` for ingestion sources and AI enrichment
- `packages/shared` - shared TypeScript contracts
- `supabase` - migrations and seed data including `event_candidates`, `ingest_runs`, and `event_sources`

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

Copy `.env.example` to `.env.local` for app-specific secrets as integrations come online.

For fast UI-only mobile testing, run:

```bash
pnpm dev:web
```

The Vite app runs at `http://localhost:5173`. The full stack command also starts the API worker at `http://localhost:8787`; `GET /health` is the smoke test endpoint.

For local Worker env (Supabase URL, service role, `ADMIN_REVIEW_TOKEN`, `ALLOWED_ORIGIN`), copy [apps/api/.dev.vars.example](apps/api/.dev.vars.example) to `apps/api/.dev.vars` and fill in values. Then `curl -s http://localhost:8787/events?from=2026-01-01T00:00:00.000Z&until=2027-01-01T00:00:00.000Z&limit=5` should return `ok: true` when the database has rows in range.

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

For DBeaver/Beekeeper, create a Postgres connection with host `127.0.0.1`, port `54322`, database `postgres`, user `postgres`, password `postgres`. The `event_candidates`, `event_sources`, `ingest_runs`, `events`, `venues`, and `images` tables live in the `public` schema.

The web app reads through the Worker API when `VITE_API_URL=http://localhost:8787` is set; without it, the UI falls back to mock data.

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

The web app exposes the review console at [/admin](http://localhost:5174/admin). Paste the `ADMIN_REVIEW_TOKEN` to unlock the queue. Edits made in the form are sent as a partial `event` payload on approve.

## Ingest Worker

`workers/ingest` is a Cloudflare Worker. It runs on Cron Triggers (default `0 */4 * * *`) and supports a manual `POST /trigger` endpoint guarded by `ADMIN_REVIEW_TOKEN`.

```bash
# Local: starts wrangler dev with --test-scheduled on port 8788
pnpm ingest:dev

# Manually fire a single source:
curl -X POST -H "x-admin-token: $ADMIN_REVIEW_TOKEN" \
  "http://127.0.0.1:8788/trigger?source=ticketmaster&force=true"

# Or simulate the cron locally:
curl -X POST "http://127.0.0.1:8788/__scheduled?cron=0+*%2F4+*+*+*"
```

Sources are configured in the `event_sources` Supabase table. Toggle the `enabled` column or change `cadence_minutes` and `config` to control runs. After every run, the Worker logs structured JSON (`event=ingest_run`) and writes `last_run_at`/`last_status` back to the row.

If a Workers AI binding (`AI`) or `ANTHROPIC_API_KEY` is configured, the Worker also runs an AI pre-review pass over recent pending candidates. It tightens the confidence score, suggests a category and tags, and auto-rejects obvious junk (status moves to `rejected` with `reviewed_by = "ai"`).

The `ai-discovery` source can scrape no-API venue pages with an LLM. Add URLs by updating its `config` in the `event_sources` row, e.g.

```sql
update public.event_sources
set config = jsonb_build_object('urls', jsonb_build_array(
  jsonb_build_object('url', 'https://www.tower2023.com/events', 'label', 'Tower Theatre')
), 'maxPerUrl', 20),
    enabled = true
where key = 'ai-discovery';
```

## Scripts

- `pnpm dev` - run the web app and API worker in parallel
- `pnpm dev:web` - run the Vite app
- `pnpm dev:api` - run the Hono worker with Wrangler
- `pnpm ingest:dev` - run the ingest Worker locally via `wrangler dev --test-scheduled --port 8788` (loads `workers/ingest/.dev.vars`)
- `pnpm --filter @fresno-events/ingest deploy` - deploy the ingest Worker (Cron Triggers come from `wrangler.toml`)
- `pnpm db:start` - start local Supabase
- `pnpm db:reset` - apply migrations and seed data to local Supabase
- `pnpm typecheck` - typecheck all packages
- `pnpm build` - build all packages

## Observability

Both the API worker and the ingest worker enable Workers Observability (`[observability] enabled = true`). After deploy you can:

- `wrangler tail fresno-events-api` and `wrangler tail fresno-events-ingest` for live structured logs.
- View per-cron dashboards in the Cloudflare Workers UI for `fresno-events-ingest`.

The ingest worker emits structured JSON log events including `ingest_run` (per source), `ai_enrichment`, `image_mirror_failed` (from the API worker), `source_budget_exceeded`, and `record_source_run_failed`. Per-run budgets are controlled by `MAX_SOURCES_PER_RUN` and `MAX_ENRICH_PER_RUN` (env vars; defaults `8` and `25`).

For the frontend, set `VITE_SENTRY_DSN` to enable error tracking. The web app already imports `@sentry/react`; wire `Sentry.init({ dsn: import.meta.env.VITE_SENTRY_DSN })` in `apps/web/src/main.tsx` before deploying to production.

## Cloud Deploy

The recommended production stack is Supabase Cloud + Cloudflare. See [docs/DEPLOY.md](docs/DEPLOY.md) for the full step-by-step. Summary:

1. **Supabase Cloud (prod project)**
   - Create a new project, then `supabase link --project-ref <ref>` and `supabase db push` from this repo to apply migrations.
   - In the dashboard, copy the project URL, anon key, and `service_role` key. Store them as Wrangler secrets (next steps).

2. **Cloudflare Pages (frontend)**
   - Create a Pages project from this repo. Build command `pnpm install && pnpm --filter @fresno-events/web build`. Output dir `apps/web/dist`.
   - Environment variables: `VITE_API_URL=https://api.whatupfresno.com`, optionally `VITE_SENTRY_DSN`, and `VITE_COMING_SOON=true` for the holding-page deploy.
   - Attach `whatupfresno.com` and `www.whatupfresno.com` as custom domains.

3. **Cloudflare Worker for the API**
   - `cd apps/api && wrangler deploy` (production). Then in the dashboard add a Worker Custom Domain `api.whatupfresno.com`.
   - Secrets: `wrangler secret put SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `ADMIN_REVIEW_TOKEN`, optionally `R2_PUBLIC_BASE_URL`.
   - The wrangler.toml already binds the `EVENT_IMAGES` R2 bucket; create it with `wrangler r2 bucket create fresno-event-images-prod` and update `bucket_name`.

4. **Cloudflare Worker for ingest**
   - `cd workers/ingest && wrangler deploy`. Cron Triggers in `wrangler.toml` will be installed automatically.
   - Secrets: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `ADMIN_REVIEW_TOKEN`, plus per-source API keys (`TICKETMASTER_API_KEY`, etc.).
   - To use Workers AI for enrichment leave the `[ai] binding = "AI"` in `wrangler.toml`. To use Anthropic instead, `wrangler secret put ANTHROPIC_API_KEY` and remove the AI binding.

5. **DNS**
   - `whatupfresno.com` and `www.whatupfresno.com` -> Pages project (proxied A/AAAA records auto-created when you add the custom domains).
   - `api.whatupfresno.com` -> Worker Custom Domain on `fresno-events-api` (auto-created).
   - Optional: `images.whatupfresno.com` -> R2 public bucket if you front-end the bucket with a CDN, then set `R2_PUBLIC_BASE_URL=https://images.whatupfresno.com`.

## Design Gate

Before building production event cards, calendar rows, map sheets, or detail pages, review Luma, Partiful, Dice, and Resy in-browser and iterate with mock data until the Fresno Events components feel like a polished 2026 product.
