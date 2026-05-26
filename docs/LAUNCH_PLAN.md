# What Up Fresno — setup and build plan

**One doc for what you do by hand.** Cloud production deploy (API, Pages, bootstrap SPA, promotion) is in **[PROD_DEPLOYMENT_PLAN.md](PROD_DEPLOYMENT_PLAN.md)** — Phase 5 below links there. Ingest pipeline design is in [INGESTION_OVERHAUL_PLAN.md](INGESTION_OVERHAUL_PLAN.md).

---

## Where you are going

```mermaid
flowchart LR
  setup[You: Docker + DB + secrets]
  code[Implement ingestion overhaul]
  ingest[Dry-run then real ingest]
  devDb[(Dev Supabase)]
  ui[UI against real data]

  setup --> code --> ingest --> devDb --> ui
```

| Phase | Who | Outcome |
|-------|-----|---------|
| **1 — Now** | You | Local Docker Supabase + **cloud dev** Supabase + env files + Cloudflare BR token |
| **2 — Next** | Agent | Part 1 priority + Part 2 `ai-crawl` (see [INGESTION_OVERHAUL_PLAN.md](INGESTION_OVERHAUL_PLAN.md)) |
| **3 — Then** | You | Dry-run → real ingest → `event_candidates` in **dev DB** |
| **4 — Then** | You + agent | `/admin` approve → Today page with real events |
| **5 — Later** | You | Cloud Workers/Pages prod — see [PROD_DEPLOYMENT_PLAN.md](PROD_DEPLOYMENT_PLAN.md) (not needed for UI work) |

**Prod ingest is off by design.** Scraping runs local or cloud-dev only. Prod website/API is a later step.

---

## Phase 1 — You do this now (manual setup)

### 1.1 Tools

- [ ] **Docker Desktop** running
- [ ] **Node.js 22.12+** (`node -v`) — see [.nvmrc](../.nvmrc)
- [ ] **pnpm 10** (`pnpm -v`)
- [ ] **Supabase CLI** — `npm install -g supabase` or Homebrew `supabase/tap/supabase`
- [ ] **Wrangler** — `pnpm add -g wrangler` then `wrangler login`

### 1.2 Repo install

```bash
cd /home/ranveer/app/fresno-events   # your repo path
pnpm install
```

### 1.3 Local database (Docker)

> **Migrations exist before the database does — that's the point.** `supabase/migrations/*.sql` is the source of truth for the schema. `pnpm db:reset` boots a fresh Postgres and replays them in lexical order; `supabase db push` does the same against your linked cloud project. New Phase 2 migrations (event priority, `seed_urls`) will land *on top* of the existing four.

```bash
pnpm db:start    # first run pulls images; wait until healthy
pnpm db:reset    # applies supabase/migrations + seed
pnpm db:status   # copy API URL + service_role key
```

| Service | URL |
|---------|-----|
| Studio | http://127.0.0.1:54423 |
| REST API | http://127.0.0.1:54321 |
| Postgres | `postgresql://postgres:postgres@127.0.0.1:54322/postgres` |

Verify in Studio: tables `events`, `event_candidates`, `venues`, `ingest_runs`. (After Phase 2 lands, `seed_urls` will also appear.)

### 1.4 Cloud dev database (Supabase)

This is the **dev DB** you will load with real ingested events for UI work (not prod).

1. [supabase.com/dashboard](https://supabase.com/dashboard) → **New project**
2. Name: `what-up-fresno-dev` (or pick one name and stick to it)
3. Region: `us-west-1` (or closest)
4. Save the **database password**
5. Settings → API → copy **Project URL** and **service_role** key (secret)

Link and push schema from repo root:

```bash
supabase login
supabase link --project-ref <YOUR_PROJECT_REF>
supabase db push
```

Check cloud Studio: same tables as local.

**Cursor agents:** query cloud dev via Supabase MCP; query local via Docker — [DATABASE_ACCESS.md](DATABASE_ACCESS.md).

### 1.5 Cloudflare Browser Rendering token (for Part 2 ingest)

Required before `ai-crawl` works.

1. [dash.cloudflare.com/profile/api-tokens](https://dash.cloudflare.com/profile/api-tokens) → Create Token → Custom
2. Permissions: **Account → Browser Rendering → Edit**
3. Account Resources: your account
4. Save token + **Account ID** (dashboard sidebar)

Optional spike (do after token exists):

```bash
export CLOUDFLARE_ACCOUNT_ID=...
export CLOUDFLARE_API_TOKEN=...
curl -X POST "https://api.cloudflare.com/client/v4/accounts/$CLOUDFLARE_ACCOUNT_ID/browser-rendering/crawl" \
  -H "Authorization: Bearer $CLOUDFLARE_API_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"url":"https://towertheatrefresno.com/events","limit":5,"depth":2,"render":true,"formats":["markdown"],"rejectResourceTypes":["image","media","font","stylesheet"],"crawlPurposes":["search","ai-input"],"options":{"includeExternalLinks":false,"includeSubdomains":false}}'
```

Poll with the returned job id until `status` is `completed` and markdown looks usable.

### 1.6 LLM key (local ingest)

The ingest worker's LLM registry (`workers/ingest/src/llm/registry.ts`) tries Workers AI → Gemini → Anthropic. Provide **at least one**:

- [ ] [Google AI Studio](https://aistudio.google.com/) → **`GEMINI_API_KEY`** (recommended for dev — fast, cheap, no Worker binding required)
- [ ] **`ANTHROPIC_API_KEY`** — fallback / parity testing
- [ ] Workers AI (`AI` binding) — works on `wrangler dev` if you wire `[ai] binding = "AI"` in `workers/ingest/wrangler.toml`; no key needed but uses your Cloudflare account quota

### 1.7 Env files

**Single source of truth:** repo-root `dev-target.env` (copy from `dev-target.env.example`). Never commit real secrets.

```bash
cp dev-target.env.example dev-target.env
# Fill Supabase *_LOCAL / *_CLOUD_DEV, ADMIN_REVIEW_TOKEN, ALLOWED_ORIGINS, ingest keys (see example)
pnpm env:local    # or pnpm env:cloud-dev — regenerates apps/api + workers/ingest .dev.vars
```

`apps/api/.dev.vars` and `workers/ingest/.dev.vars` are **auto-generated** — edit `dev-target.env` only. **Do not put BR / LLM keys in `dev-target.env` sections meant for API** — those keys live under the ingest section in the example file.

`ADMIN_REVIEW_TOKEN` is set once in `dev-target.env` and copied to both workers. Ingest uses it for `POST /trigger`; the API uses it for `/review/*`; `scripts/ingest-run.sh` reads it from the generated `workers/ingest/.dev.vars`.

**For UI work on cloud dev data:** `pnpm env:cloud-dev` (fills both `.dev.vars` from `SUPABASE_URL_CLOUD_DEV` + key), then restart `pnpm dev:api` and `pnpm ingest:dev`.

**Web app** — create `apps/web/.env.local`:

```
VITE_API_URL=http://127.0.0.1:8787
VITE_SUPABASE_URL=<only if you use supabase client in browser>
VITE_SUPABASE_ANON_KEY=<cloud or local anon key>
```

Or run: `pnpm dev:web:local-api` (sets API URL for you).

### 1.8 Smoke test stack (optional, before ingest code lands)

```bash
# Terminal 1
pnpm dev:api          # or: cd apps/api && pnpm dev  → :8787

# Terminal 2
curl -s "http://127.0.0.1:8787/health"

# Terminal 3
pnpm dev:web:local-api   # → :5173
```

`GET /events` may return `[]` until you have data — that is fine.

### Phase 1 done when

- [ ] Local `pnpm db:reset` works
- [ ] Cloud dev `supabase db push` works
- [ ] `.dev.vars` filled for ingest + API
- [ ] BR curl spike returns markdown (or you know which site fails and why)
- [ ] `pnpm dev:api` + `pnpm dev:web:local-api` load

---

## Phase 2 — Implement ingestion overhaul (agent / code)

**Spec:** [INGESTION_OVERHAUL_PLAN.md](INGESTION_OVERHAUL_PLAN.md)

**Order:**

1. Part 1 — `events.priority` (0–5), API sort, admin dropdown, Today page
2. Part 2 — `seed_urls` table, Browser Rendering `/crawl`, `ai-crawl` scraper, markdown extractor, `--resume-jobs` flag
3. **In-tree READMEs** alongside the code (`workers/ingest/README.md`, `apps/api/README.md`, `apps/web/README.md`, `supabase/README.md`, `packages/shared/README.md`, `scripts/README.md`, plus root `README.md` and a `docs/PROMOTION.md` stub) — see [INGESTION_OVERHAUL_PLAN.md §12](INGESTION_OVERHAUL_PLAN.md). Required topics: purpose, local dev, Cloudflare deploy, common ops (add a seed URL, add a scraper, add a migration), flags / env vars, gotchas.
4. Migrations on **local** first, then `supabase db push` to cloud dev

**You:** approve the plan / say "implement Phase 1" then "implement Phase 2".

**Not in this phase:** prod deploy, prod ingest cron, LAUNCH_PLAN cloud Workers (Phase 5).

---

## Phase 3 — You: dry-run and real ingest (dev DB)

After Part 2 code is in the repo and migrations are applied.

### 3.1 Point ingest at dev DB

In `workers/ingest/.dev.vars`, use **cloud dev** `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` so candidates land where the UI will read them.

### 3.2 Terminals

```bash
# Terminal 1 — ingest worker (keep running)
pnpm ingest:dev

# Terminal 2 — commands from repo root
```

### 3.3 One seed while learning

In cloud (or local) Studio:

```sql
update seed_urls set enabled = false where label != 'Tower Theatre';
```

### 3.4 Dry-run (costs real BR + LLM; **fully read-only against DB**)

```bash
pnpm ingest:run --source=ai-crawl --dry-run --force
```

Check JSON output for plausible events. Neither `event_candidates` nor `seed_urls` should be written ([INGESTION_OVERHAUL_PLAN.md §5.4a](INGESTION_OVERHAUL_PLAN.md)). Re-runnable as many times as you want; only cost is BR seconds + LLM tokens.

### 3.5 Real run (writes candidates and seed_urls state)

```bash
pnpm ingest:run --source=ai-crawl --force
```

Verify in Studio → `event_candidates` (`source` like `scrape:towertheatrefresno.com`, `pending_review`) and `seed_urls.last_successful_crawl_at` populated.

Re-enable seeds:

```sql
update seed_urls set enabled = true;
```

### 3.6 Resume in-flight BR jobs (validation gate 5)

If a real run was killed mid-poll, or hit the 8-min per-seed deadline with status still `running`, continue the same Cloudflare BR job without starting new ones:

```bash
pnpm ingest:run --source=ai-crawl --resume-jobs --force
```

This only processes seeds with a non-null, non-terminal `seed_urls.br_crawl_job_id` and writes candidates as a normal real run. Mutually exclusive with `--dry-run`.

Optional: `pnpm ingest:run --source=ticketmaster --force` for API-sourced events.

---

## Phase 4 — UI work (real data)

```bash
# Local API + web reading from local OR cloud-dev Supabase (whichever .dev.vars is set)
pnpm dev
# or: pnpm dev:api in one terminal, pnpm dev:web:local-api in another

# Web only, pointing at the *deployed* cloud-dev API (skips local apps/api)
pnpm dev:web:cloud-dev
```

| URL | Purpose |
|-----|---------|
| http://localhost:5173/admin | Review queue — paste `ADMIN_REVIEW_TOKEN` |
| http://localhost:5173 | Today / events UI |

`pnpm dev:web:cloud-dev` (script: `scripts/dev-web-cloud.sh dev`) is the fastest way to validate the UI against real ingested data without running `apps/api` locally — useful once Phase 5 deploys the dev API Worker.

**Flow:**

1. Approve candidates with priorities (0 sponsored, 1 headline, 5 default)
2. Confirm `events` table in dev Supabase
3. Confirm Today page order and “Sponsored” / “Start here” labels
4. Iterate on UI with agent

**Ingest commands reference:** [INGEST.md](INGEST.md)

---

## Phase 5 — Later (not needed for UI)

When local + cloud dev ingest and review feel good, follow **[PROD_DEPLOYMENT_PLAN.md](PROD_DEPLOYMENT_PLAN.md)** (checklist + architecture). In short:

- Deploy **dev** API + ingest Workers (`wrangler deploy --env dev`)
- Deploy **prod** API + Pages only — **no prod ingest**
- Promote events dev → prod (manual / future automation)
- Web: static SPA on Pages; optional **home bootstrap JSON** for fast default `/` (filters/dates stay client + API — same SPA, no handoff)
- Optional: `_headers` for asset caching; `api.whatupfresno.com` + `whatupfresno.com` DNS in Cloudflare dashboard

Most Cloudflare/Supabase setup is already in place; use PROD_DEPLOYMENT_PLAN for what is left (prod API, Pages, promotion). Old deploy runbook text, if needed: `git log -- docs/DEPLOY.md` then `git show <commit>:docs/DEPLOY.md`.

---

## Quick reference

| Command | What |
|---------|------|
| `pnpm db:start` | Start local Supabase (Docker) |
| `pnpm db:reset` | Reset local DB + apply `supabase/migrations/` + `seed.sql` |
| `pnpm db:status` | Print local API URL + service_role key |
| `supabase db push` | Apply migrations to linked cloud project |
| `pnpm ingest:dev` | Ingest worker on :8788 |
| `pnpm ingest:run --source=ai-crawl --dry-run --force` | Preview scrape (read-only against DB) |
| `pnpm ingest:run --source=ai-crawl --force` | Persist candidates |
| `pnpm ingest:run --source=ai-crawl --resume-jobs --force` | Continue in-flight BR jobs only |
| `pnpm dev` | API :8787 + web :5173 |
| `pnpm dev:web:local-api` | Web with API URL set |

## Related docs

| Doc | Use |
|-----|-----|
| [INGESTION_OVERHAUL_PLAN.md](INGESTION_OVERHAUL_PLAN.md) | Architecture, SQL, modules, validation gates, run modes (§5.4 / §5.4a), in-tree docs spec (§12) |
| [INGEST.md](INGEST.md) | Short ingest operator notes |
| [AI_DISCOVERY.md](AI_DISCOVERY.md) | Legacy `ai-discovery` (until `ai-crawl` replaces it) |
| [PROD_DEPLOYMENT_PLAN.md](PROD_DEPLOYMENT_PLAN.md) | **Phase 5** — prod API, Pages, SPA bootstrap, promotion |
| `<area>/README.md` | After Part 2 lands, each code area (apps/api, apps/web, workers/ingest, packages/shared, supabase, scripts) ships its own README per [INGESTION_OVERHAUL_PLAN.md §12](INGESTION_OVERHAUL_PLAN.md) |
| [docs/PROMOTION.md](PROMOTION.md) | Future dev → prod event promotion (stub created in Part 2) |
