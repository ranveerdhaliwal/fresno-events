# Deployment checklist

This is the fastest path from a green local stack to `whatupfresno.com` live, using Supabase Cloud + Cloudflare. Each step is short, and the order matters.

---

## What this doc automates vs what stays manual

This walkthrough is for **you in a browser + terminal**. The agent that authored these docs cannot create Supabase projects, run interactive `wrangler login`, set Wrangler secrets, create Cloudflare Pages projects, or add custom domains on your behalf — those require your account session.

| Step | Where it happens |
| --- | --- |
| Edit repo files (this doc, `wrangler.toml`, `.dev.vars.example`, scripts, code) | Already done in the repo |
| Add Supabase MCP entry to `.cursor/mcp.json` | Done; you fill in `<DEV_PROJECT_REF>` and `SUPABASE_ACCESS_TOKEN` after A1 |
| Apply migrations to dev / prod Supabase once projects exist | You run `supabase db push` (or via Supabase MCP `apply_migration`) |
| Create Supabase projects (dev + prod) | You, in browser at supabase.com |
| `wrangler login` | You, in terminal |
| Deploy Workers (`wrangler deploy --env dev`, `--env prod`) | You, in terminal |
| Set Wrangler secrets | You, in terminal (interactive) |
| Create Pages project + connect repo | You, in browser at dash.cloudflare.com |
| Add custom domains | You, in browser |
| Enable R2 (one-time, requires payment method) | You, in browser |

Everything past step 0 is something you actively do.

---

## Environment matrix

One row per environment shows every moving piece and how they line up.

| Surface | Local | Cloud dev | Cloud prod |
| --- | --- | --- | --- |
| Database | Local Supabase (`pnpm db:start`, `54321`/`54322`/`54323`) | Supabase project `what-up-fresno-dev` | Supabase project `what-up-fresno-prod` |
| API Worker name | `fresno-events-api` (top-level) | `fresno-events-api-dev` (`--env dev`) | `fresno-events-api` (`--env prod`) |
| API Worker URL | `http://localhost:8787` | `https://fresno-events-api-dev.<account>.workers.dev` | `https://api.whatupfresno.com` |
| Ingest Worker name | `fresno-events-ingest` (top-level) | `fresno-events-ingest-dev` (`--env dev`) | `fresno-events-ingest` (`--env prod`) |
| Ingest Worker URL | `http://localhost:8788` | `https://fresno-events-ingest-dev.<account>.workers.dev` | `https://fresno-events-ingest.<account>.workers.dev` |
| Cron triggers | none (manual `/trigger` only) | none by default | `0 */4 * * *` |
| R2 bucket | `fresno-event-images-dev` | `fresno-event-images-dev` | `fresno-event-images-prod` |
| Pages branch | n/a | `dev` (preview) | `main` (production) |
| Vite UI URL | `http://localhost:5173` | `https://<hash>.fresno-events.pages.dev` | `https://whatupfresno.com` |
| `VITE_API_URL` for that UI | `http://localhost:8787` | dev API Worker URL | `https://api.whatupfresno.com` |
| Wrangler `--env` flag | none | `--env dev` | `--env prod` |
| Local secrets file | `.dev.vars` | `.dev.vars.dev` | `.dev.vars.prod` (rarely used; prefer Wrangler secrets) |

### Wrangler env profiles

Both Workers ship with `[env.dev]` and `[env.prod]` blocks ([apps/api/wrangler.toml](apps/api/wrangler.toml), [workers/ingest/wrangler.toml](workers/ingest/wrangler.toml)).

- `wrangler dev --env dev` loads `.dev.vars.dev` (falls back to `.dev.vars`).
- `wrangler deploy --env dev` ships the dev-suffixed Worker.
- Same pattern for `--env prod`.
- Top-level (no `--env`) is the local profile and uses `.dev.vars`.
- There is no `--var-file` flag in Wrangler; `.dev.vars.<env>` is the supported pattern.

### Pointing local Vite at any backend

```bash
pnpm dev:web:local-api   # -> http://localhost:8787
pnpm dev:web:cloud-dev   # -> dev Worker URL (reads .env.cloud-targets)
pnpm dev:web:cloud-prod  # -> https://api.whatupfresno.com
```

Create `.env.cloud-targets` at the repo root once (gitignored):

```
VITE_API_URL_DEV=https://fresno-events-api-dev.<account>.workers.dev
VITE_API_URL_PROD=https://api.whatupfresno.com
```

---

## Migration push order

Always dev first, then prod. Use `--db-url` so it doesn't depend on the implicit `supabase link` state:

```bash
pnpm dlx supabase db push --db-url "postgresql://postgres:<DEV_PASS>@db.<DEV_REF>.supabase.co:5432/postgres"
# smoke-test, then:
pnpm dlx supabase db push --db-url "postgresql://postgres:<PROD_PASS>@db.<PROD_REF>.supabase.co:5432/postgres"
```

---

## Secret parity checklist

Before flipping prod cron triggers on, confirm both API and ingest Workers in dev and prod have the same logical secrets:

| Worker | Secret | Required? |
| --- | --- | --- |
| API | `SUPABASE_URL` | yes |
| API | `SUPABASE_SERVICE_ROLE_KEY` | yes |
| API | `ADMIN_REVIEW_TOKEN` | yes (review endpoints) |
| API | `R2_PUBLIC_BASE_URL` | optional (CDN-fronted R2) |
| Ingest | `SUPABASE_URL` | yes |
| Ingest | `SUPABASE_SERVICE_ROLE_KEY` | yes |
| Ingest | `ADMIN_REVIEW_TOKEN` | yes (`POST /trigger`) |
| Ingest | `TICKETMASTER_API_KEY` | per-source |
| Ingest | `SEATGEEK_CLIENT_ID` / `SEATGEEK_CLIENT_SECRET` | per-source |
| Ingest | `EVENTBRITE_API_KEY` | per-source |
| Ingest | `BANDSINTOWN_APP_ID` | per-source |
| Ingest | `ANTHROPIC_API_KEY` | optional (overrides Workers AI) |

A missing per-source key looks like silent zero-event runs in `wrangler tail`.

---

## 0. Prerequisites (one-time, in browser)

1. Cloudflare account with a payment method (R2 requires it). Enable R2 from the Cloudflare dashboard sidebar.
2. Supabase account.
3. Source-API accounts you intend to enable (Ticketmaster, SeatGeek, Eventbrite, Bandsintown). Anthropic optional.
4. `wrangler login` from this machine.
5. `pnpm dlx supabase login` from this machine.
6. (Optional, for AI-assisted data cleanup) Supabase personal access token from `supabase.com/dashboard/account/tokens`. See [Supabase MCP](#supabase-mcp-ai-assisted-data-cleanup) below.

---

## Part A: Dev environment in the cloud

A cloud dev environment lets you test real data ingestion and review without touching prod. It uses a separate Supabase project, separate Cloudflare Worker environments (or `-dev` suffixed Workers), and a Pages preview deployment.

### A1. Supabase Cloud (dev project)

```bash
pnpm dlx supabase projects create what-up-fresno-dev --org-id <ORG_ID> --region us-west-1
pnpm dlx supabase link --project-ref <DEV_PROJECT_REF>
pnpm dlx supabase db push
```

Copy from the dashboard:
- `SUPABASE_URL` (dev project URL, e.g. `https://xxxx.supabase.co`)
- `SUPABASE_SERVICE_ROLE_KEY` (Settings -> API)

Generate a dev admin token:

```bash
openssl rand -hex 32
```

### A2. Cloudflare R2 bucket (dev)

```bash
wrangler r2 bucket create fresno-event-images-dev
```

The dev API worker's `wrangler.toml` already has `bucket_name = "fresno-event-images-dev"` so no change needed for dev.

### A3. Deploy the dev API worker

The dev profile (`[env.dev]` in [apps/api/wrangler.toml](apps/api/wrangler.toml)) names the Worker `fresno-events-api-dev`, binds the dev R2 bucket, and sets `ALLOWED_ORIGINS` to localhost. Deploy + secrets:

```bash
cd apps/api

wrangler deploy --env dev

wrangler secret put SUPABASE_URL --env dev
wrangler secret put SUPABASE_SERVICE_ROLE_KEY --env dev
wrangler secret put ADMIN_REVIEW_TOKEN --env dev
```

The dev worker will be reachable at `https://fresno-events-api-dev.<account>.workers.dev`. No custom domain needed.

Verify:

```bash
curl -s https://fresno-events-api-dev.<account>.workers.dev/health
```

When the dev Pages preview goes live, edit `[env.dev.vars] ALLOWED_ORIGINS` in `wrangler.toml` to include the preview URL:

```toml
ALLOWED_ORIGINS = "http://localhost:5173,https://dev.fresno-events.pages.dev"
```

Then redeploy: `wrangler deploy --env dev`.

### A4. Deploy the dev ingest worker

```bash
cd workers/ingest

wrangler deploy --env dev

wrangler secret put SUPABASE_URL --env dev
wrangler secret put SUPABASE_SERVICE_ROLE_KEY --env dev
wrangler secret put ADMIN_REVIEW_TOKEN --env dev
wrangler secret put TICKETMASTER_API_KEY --env dev
```

Test a manual run:

```bash
curl -X POST -H "x-admin-token: $DEV_ADMIN_TOKEN" \
  "https://fresno-events-ingest-dev.<account>.workers.dev/trigger?source=ticketmaster&force=true"
```

The dev profile intentionally has no `[env.dev.triggers]` block, so Cron Triggers are off in dev — runs only happen via `/trigger`. Production cron lives in `[env.prod.triggers]` (Part B).

### A5. Dev frontend (Pages preview)

Cloudflare Pages creates preview deployments for every branch or push automatically when connected to a repo. To get a dedicated dev preview:

1. In the Pages project settings, set a **preview branch** (e.g. `dev`).
2. Environment variables for preview deployments:
   - `VITE_API_URL=https://fresno-events-api-dev.<account>.workers.dev`
   - `VITE_COMING_SOON=false`
3. Every push to the `dev` branch produces a URL like `https://<hash>.fresno-events.pages.dev`.

Alternatively, build and deploy locally:

```bash
VITE_API_URL=https://fresno-events-api-dev.<account>.workers.dev \
  pnpm --filter @fresno-events/web build

wrangler pages deploy apps/web/dist --project-name fresno-events --branch dev
```

### A6. Verify end-to-end (dev)

1. Trigger a dev ingest run (A4 curl above).
2. Open the Pages preview URL at `/admin`, paste the dev admin token.
3. Approve a candidate and confirm the event appears at `/` or via `GET /events`.
4. Check the images endpoint to see the R2 mirror worked.

---

## Part B: Production deploy

### B1. Supabase Cloud (production project)

```bash
pnpm dlx supabase projects create what-up-fresno-prod --org-id <ORG_ID> --region us-west-1
pnpm dlx supabase link --project-ref <PROD_PROJECT_REF>
pnpm dlx supabase db push
```

Copy from the dashboard:
- `SUPABASE_URL` (project URL)
- `SUPABASE_SERVICE_ROLE_KEY` (Settings -> API)

Generate a production admin token:

```bash
openssl rand -hex 32
```

### B2. Cloudflare R2 bucket (prod)

```bash
wrangler r2 bucket create fresno-event-images-prod
```

The prod profile (`[env.prod]` in [apps/api/wrangler.toml](apps/api/wrangler.toml)) is already wired to `bucket_name = "fresno-event-images-prod"`. No edit needed.

### B3. API worker (prod)

```bash
cd apps/api
wrangler secret put SUPABASE_URL --env prod
wrangler secret put SUPABASE_SERVICE_ROLE_KEY --env prod
wrangler secret put ADMIN_REVIEW_TOKEN --env prod
# optional:
wrangler secret put R2_PUBLIC_BASE_URL --env prod   # e.g. https://images.whatupfresno.com
wrangler deploy --env prod
```

Then in the Cloudflare dashboard for the `fresno-events-api` Worker -> Triggers -> Custom Domains, add `api.whatupfresno.com`. DNS will be created automatically.

`[env.prod.vars] ALLOWED_ORIGINS` ships pre-set to `https://whatupfresno.com,https://www.whatupfresno.com`. Adjust if your apex differs.

Verify:

```bash
curl -s https://api.whatupfresno.com/health
```

### B4. Ingest worker (prod)

```bash
cd workers/ingest
wrangler secret put SUPABASE_URL --env prod
wrangler secret put SUPABASE_SERVICE_ROLE_KEY --env prod
wrangler secret put ADMIN_REVIEW_TOKEN --env prod
wrangler secret put TICKETMASTER_API_KEY --env prod
# optional, only if you enable these source rows:
wrangler secret put SEATGEEK_CLIENT_ID --env prod
wrangler secret put SEATGEEK_CLIENT_SECRET --env prod
wrangler secret put EVENTBRITE_API_KEY --env prod
wrangler secret put BANDSINTOWN_APP_ID --env prod
# optional, AI fallback if you remove the [ai] binding:
wrangler secret put ANTHROPIC_API_KEY --env prod
wrangler deploy --env prod
```

Cron Triggers come from `[env.prod.triggers]`. Confirm they installed in dashboard -> Workers -> fresno-events-ingest -> Triggers.

Manual smoke test:

```bash
curl -X POST -H "x-admin-token: $ADMIN_REVIEW_TOKEN" \
  "https://fresno-events-ingest.<your-account>.workers.dev/trigger?source=ticketmaster&force=true"
```

Watch live logs:

```bash
wrangler tail fresno-events-ingest
```

### B5. Frontend (Cloudflare Pages, prod)

In the Cloudflare dashboard create a Pages project pointed at this repo (or upload a build):

- Build command: `pnpm install && pnpm --filter @fresno-events/web build`
- Build output: `apps/web/dist`
- Environment: `VITE_API_URL=https://api.whatupfresno.com`
- Optional: `VITE_SENTRY_DSN`, `VITE_COMING_SOON=true` (until you flip the launch).

Add custom domains `whatupfresno.com` and `www.whatupfresno.com`. DNS records auto-created.

### B6. Post-deploy

1. Open `https://whatupfresno.com/admin`, paste the admin token, and approve a Ticketmaster candidate end-to-end.
2. Toggle additional sources by editing the `event_sources` table in the Supabase dashboard.
3. Optional: front the R2 bucket with `images.whatupfresno.com` and set `R2_PUBLIC_BASE_URL` so images bypass the API worker.

---

## Part C: Adding more event sources

The ingest system is designed so you can add new sources without touching code (for API sources with existing scrapers) or with a single new scraper file (for new APIs or sites).

### C1. Enable a built-in source (no code needed)

The following scrapers are already implemented: `ticketmaster`, `seatgeek`, `eventbrite`, `bandsintown`, `ai-discovery`.

To turn one on, update the `event_sources` table (Supabase Studio or SQL):

```sql
-- Enable SeatGeek with a 12-hour cadence
update public.event_sources
set enabled = true, cadence_minutes = 720
where key = 'seatgeek';
```

Then add the required API keys as wrangler secrets:

| Source | Required secrets |
| --- | --- |
| `ticketmaster` | `TICKETMASTER_API_KEY` |
| `seatgeek` | `SEATGEEK_CLIENT_ID`, `SEATGEEK_CLIENT_SECRET` |
| `eventbrite` | `EVENTBRITE_API_KEY` |
| `bandsintown` | `BANDSINTOWN_APP_ID` |
| `ai-discovery` | Workers AI binding (auto) or `ANTHROPIC_API_KEY` |

```bash
cd workers/ingest
wrangler secret put SEATGEEK_CLIENT_ID
wrangler secret put SEATGEEK_CLIENT_SECRET
wrangler deploy
```

Test the new source:

```bash
curl -X POST -H "x-admin-token: $ADMIN_REVIEW_TOKEN" \
  "https://fresno-events-ingest.<account>.workers.dev/trigger?source=seatgeek&force=true"
```

### C2. Adjust how often a source runs

Change `cadence_minutes` in the `event_sources` row. The ingest worker checks this at every cron invocation and only runs a source if enough time has elapsed since `last_run_at`.

```sql
-- Run Ticketmaster every 2 hours instead of every 6
update public.event_sources set cadence_minutes = 120 where key = 'ticketmaster';
```

### C3. Add source-specific config

The `config` jsonb column is passed to each scraper as `ctx.config`. Scrapers read fields like `radiusMiles`, `urls`, `maxPerUrl`, and `artists` from it.

```sql
-- Bandsintown: configure which artists to monitor in Fresno
update public.event_sources
set config = '{"artists": "Deftones,Tower of Power,Grupo Firme,Blink-182"}'::jsonb,
    enabled = true
where key = 'bandsintown';
```

### C4. Write a new scraper (new API or site)

1. Create `workers/ingest/src/scrapers/<name>.ts` following the pattern of `ticketmaster.ts`:
   - Export an `async function run(ctx: ScrapeContext): Promise<ScrapeResult>`.
   - Read API keys from `ctx.secrets.<KEY_NAME>`.
   - Read source-specific config from `ctx.config`.
   - Return `NormalizedEvent[]` in the result.

2. Register it in `workers/ingest/src/registry.ts`:

```typescript
import { run as runMySource } from "@/scrapers/my-source";

// Add to the scrapers array:
{
  key: "my-source",
  label: "My New Source",
  defaultCadenceMinutes: 720,
  enabledByDefault: false,
  requiredSecrets: ["MY_SOURCE_API_KEY"],
  run: runMySource
}
```

3. Add the env key to `workers/ingest/src/env.ts`:

```typescript
MY_SOURCE_API_KEY?: string;
```

4. Insert a row in `event_sources` (via migration or directly):

```sql
insert into public.event_sources (key, label, kind, config, cadence_minutes, enabled) values
  ('my-source', 'My New Source', 'api', '{}'::jsonb, 720, true);
```

5. Set the secret and redeploy:

```bash
wrangler secret put MY_SOURCE_API_KEY --name fresno-events-ingest
wrangler deploy
```

---

## Part D: Setting up the AI discovery agent

The AI discovery agent scrapes HTML from venue/event websites that have no API, sends the cleaned text to an LLM, and extracts structured event data. It then writes the results into `event_candidates` as `pending_review`.

### D1. Choose an AI backend

The ingest worker supports two backends. Pick one:

| Backend | How to enable | Cost | Speed |
| --- | --- | --- | --- |
| **Workers AI** (default) | Already configured via `[ai] binding = "AI"` in `wrangler.toml`. No secrets needed. | Free tier available (Llama 3.1 8B) | Fast, runs on Cloudflare edge |
| **Anthropic** | `wrangler secret put ANTHROPIC_API_KEY`. Remove the `[ai]` section from `wrangler.toml` if you want Anthropic-only. | Pay-per-token (Claude 3.5 Haiku) | Higher quality extraction |

If both are configured, Workers AI takes priority.

### D2. Add URLs to scrape

The AI discovery source reads a list of URLs from its `config.urls` array in the `event_sources` table. Each entry has a `url` (required) and `label` (optional, for logging).

```sql
update public.event_sources
set config = jsonb_build_object(
  'urls', jsonb_build_array(
    jsonb_build_object('url', 'https://towertheatrefresno.com/events', 'label', 'Tower Theatre'),
    jsonb_build_object('url', 'https://www.fultonstreetfresno.com/events', 'label', 'Fulton Street Events'),
    jsonb_build_object('url', 'https://www.savemart.center/events', 'label', 'Save Mart Center'),
    jsonb_build_object('url', 'https://www.fresnofairgrounds.com/calendar', 'label', 'Big Fresno Fair'),
    jsonb_build_object('url', 'https://www.cityoffresno.gov/parks/events/', 'label', 'City of Fresno Parks'),
    jsonb_build_object('url', 'https://strummers.com/', 'label', 'Strummers'),
    jsonb_build_object('url', 'https://www.valhallabar.com/events', 'label', 'Valhalla'),
    jsonb_build_object('url', 'https://www.tiogasequoia.com/taproom-events', 'label', 'Tioga-Sequoia')
  ),
  'maxPerUrl', 20
),
enabled = true
where key = 'ai-discovery';
```

Good sources to add:
- Venue websites with an `/events` or `/calendar` page (Tower Theatre, Strummers, Valhalla, Save Mart Center, Chukchansi Park).
- City/county calendar pages (City of Fresno Parks, Fresno County events).
- Community sites (Fresno Bee events section, ABC30 community calendar, local Facebook event aggregators with public HTML).
- Festival and fair sites (Big Fresno Fair, Fresno Greek Fest, Rogue Festival).

Avoid sites that are entirely JavaScript-rendered (the worker fetches raw HTML, not a headless browser). Most venue sites with server-rendered event listings work well.

### D3. Enable the source and test

```bash
# Trigger a run
curl -X POST -H "x-admin-token: $ADMIN_REVIEW_TOKEN" \
  "https://fresno-events-ingest.<account>.workers.dev/trigger?source=ai-discovery&force=true"

# Watch what happens
wrangler tail fresno-events-ingest
```

The worker will:
1. Fetch each URL's HTML.
2. Strip tags and truncate to 24,000 chars.
3. Send the text to the LLM with instructions to extract events near Fresno.
4. Write extracted events as `event_candidates` with `pending_review` status and `tags: ["ai-discovery"]`.

Then open `/admin` and review the AI-discovered candidates. They'll have a default confidence score of 0.7. The AI enrichment pass (which runs automatically after every ingest cycle) will adjust the score, suggest categories, and auto-reject junk.

### D4. Tune the AI enrichment

The enrichment pass runs after every ingest cycle (scheduled or manual). It processes up to `MAX_ENRICH_PER_RUN` (default 25) pending candidates that haven't been reviewed yet. For each one it:

- Scores confidence (0-1) based on whether it looks like a real public event near Fresno.
- Suggests a category and cleaned title.
- Adds tags.
- Auto-rejects obvious junk (ads, gift cards, parking passes, livestream-only, NSFW) with `reviewed_by = "ai"`.

To adjust the budget:

```bash
# Allow more candidates per enrichment pass
cd workers/ingest
wrangler secret put MAX_ENRICH_PER_RUN  # enter e.g. 50
```

### D5. Adding new URLs over time

Just update the `config` column. No code changes or redeployment needed:

```sql
update public.event_sources
set config = config || jsonb_build_object(
  'urls', config->'urls' || jsonb_build_array(
    jsonb_build_object('url', 'https://newvenue.com/events', 'label', 'New Venue')
  )
)
where key = 'ai-discovery';
```

Or replace the whole `urls` array if it's easier to maintain:

```sql
update public.event_sources
set config = jsonb_set(config, '{urls}', '<paste full array here>'::jsonb)
where key = 'ai-discovery';
```

---

## Part E: Local scraper iteration

This is the loop you'll use to develop new scrapers and tune existing ones without touching cloud Workers.

### E1. One-time setup

1. Copy `workers/ingest/.dev.vars.example` -> `workers/ingest/.dev.vars`.
2. Fill in:
   - `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` -> **cloud dev** Supabase project (Part A1). Candidates land in dev, you can browse them in Supabase Studio without affecting prod.
   - `ADMIN_REVIEW_TOKEN` -> any string. Mirror it in your shell so the helper script can read it: `export ADMIN_REVIEW_TOKEN=<same>`.
   - `TICKETMASTER_API_KEY` (and any other source keys you want to exercise locally).
3. Optional: also create `workers/ingest/.dev.vars.dev` with the same values if you ever want `wrangler dev --env dev` parity.

If you'd rather run fully offline against local Postgres: `pnpm db:start` then point `SUPABASE_URL=http://127.0.0.1:54321` and use the local `service_role` key the CLI prints.

### E2. The loop

Two terminals:

```bash
# Tab 1: ingest worker on :8788, hot reloads on file save
pnpm ingest:dev
```

```bash
# Tab 2: trigger one source (or all)
pnpm ingest:run --source=ticketmaster --force
pnpm ingest:run --source=ai-discovery
pnpm ingest:run                          # all enabled sources, respects cadence
pnpm ingest:run --force                  # all enabled sources, ignores cadence
```

Output is the JSON `summaries` array (events found, errors, persistence result) printed via `jq`. Rows land in `event_candidates` with `status='pending_review'`. Inspect them via:

- Supabase Studio for the cloud dev project (or `http://127.0.0.1:54323` if local Postgres).
- Or the admin UI at `/admin` once `pnpm dev:web:cloud-dev` is pointing at your dev API.

### E3. Iteration tips

- `wrangler dev --test-scheduled` does **not** auto-fire scheduled runs on a timer. The scheduled handler only runs when you POST to `/__scheduled`. So local iteration is safe from surprise writes.
- The `ingest_runs` table records every run with status, timing, and counts; great for "did my new scraper actually try?" debugging.
- A failing scraper writes a row to `event_sources.last_status='error'` and `last_error`; check there before assuming the script is broken.
- Use `wrangler tail fresno-events-ingest-dev` against the deployed dev Worker if you want to test the cloud build path without polluting prod.

### E4. Pointing ingest at a different DB temporarily

Without editing files, override the env in your shell for one run:

```bash
SUPABASE_URL=https://<other-project>.supabase.co \
  SUPABASE_SERVICE_ROLE_KEY=<other-service-role> \
  pnpm ingest:dev
```

Useful for sanity-checking against a clean throwaway project.

### E5. Future: trigger from the admin UI

Currently a separate plan, not yet implemented. Concept:

1. Add `POST /admin/ingest` to [apps/api/src/index.ts](apps/api/src/index.ts) that proxies to the ingest Worker's `/trigger` (or imports `runIngest` directly).
2. Add a "Run scrapers" button block to [apps/web/src/features/admin/admin-page.tsx](apps/web/src/features/admin/admin-page.tsx) with per-source dropdown + last-summary display.
3. Stream progress via SSE if patience-friendly; otherwise return summary on response.

---

## Part F: Supabase MCP for AI-assisted data cleanup

The official [Supabase MCP server](https://github.com/supabase-community/mcp-server-supabase) exposes your Supabase project to AI tools (this assistant in any Cursor window pointed at this repo) so we can list tables, query rows, propose cleanups, and apply migrations under your supervision.

### F1. Get a personal access token

1. Visit `https://supabase.com/dashboard/account/tokens`.
2. Generate a new token (descriptive label, e.g. "Cursor MCP - what-up-fresno").
3. Copy the `sbp_...` token. Store it somewhere safe; you can't view it again.

### F2. Configure `.cursor/mcp.json`

The file already has a Supabase entry stub (gitignored, won't be committed). Replace placeholders:

```json
{
  "mcpServers": {
    "supabase": {
      "command": "npx",
      "args": [
        "-y",
        "@supabase/mcp-server-supabase",
        "--read-only",
        "--project-ref=<DEV_PROJECT_REF>"
      ],
      "env": {
        "SUPABASE_ACCESS_TOKEN": "<sbp_... from F1>"
      }
    }
  }
}
```

`<DEV_PROJECT_REF>` is the alphanumeric ID after `supabase.co/dashboard/project/` for your dev project.

Reload the Cursor window (Cmd/Ctrl+Shift+P -> "Reload Window") and the MCP picks up.

### F3. Safety guardrails (default)

- `--read-only` blocks `INSERT`, `UPDATE`, `DELETE`, `DROP`, etc., at the MCP layer. AI tools physically cannot mutate the database.
- `--project-ref=<DEV_PROJECT_REF>` scopes the server to a single project. **Prod is unreachable** through this MCP unless you add a second entry pointing at the prod ref.
- The token is project-scoped to your account; revoke from Supabase dashboard at any time.

### F4. Doing destructive cleanup work

When you want me (or another AI tool) to actually delete/update rows:

**Option A (recommended):** keep `--read-only`. AI drafts the SQL, you paste it into Supabase Studio's SQL editor, eyeball the affected rows, run it.

**Option B:** temporarily remove `--read-only` from the args, reload Cursor window, do the work, restore `--read-only`. Risky in mixed sessions.

**Option C:** add a second MCP entry called `supabase-write` pointing at dev (no `--read-only`), keep the default `supabase` entry read-only. AI must explicitly invoke the write entry, so accidental writes are unlikely.

### F5. Useful MCP tools to ask for

- `list_tables` -> schema overview.
- `execute_sql` -> arbitrary SELECT (read-only mode).
- `list_migrations` -> what's been applied.
- `apply_migration` -> apply a SQL migration to dev (requires write access).
- `get_logs` -> recent Postgres / Auth logs.

Example prompts you can drop in chat once MCP is up:

- "Find candidates in `event_candidates` with `confidence_score < 0.2` and propose a cleanup query."
- "Show me `events` rows missing `hero_image_id`; group by `category`."
- "Compare `event_sources.last_status` to recent `ingest_runs` and tell me which sources are silently failing."

### F6. Adding GitHub MCP alongside

The repo's `.cursor/mcp.json` already has a `github` entry too (gitignored). If you set up a fresh machine, add it back manually with your GitHub PAT in the `Authorization` header. See [GitHub MCP install guide for Cursor](https://github.com/github/github-mcp-server/blob/main/docs/installation-guides/install-cursor.md).
