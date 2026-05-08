# Deployment checklist

This is the fastest path from a green local stack to `whatupfresno.com` live, using Supabase Cloud + Cloudflare. Each step is short, and the order matters.

---

## 0. Prerequisites (one-time, in browser)

1. Cloudflare account with a payment method (R2 requires it). Enable R2 from the Cloudflare dashboard sidebar.
2. Supabase account.
3. Source-API accounts you intend to enable (Ticketmaster, SeatGeek, Eventbrite, Bandsintown). Anthropic optional.
4. `wrangler login` from this machine.
5. `pnpm dlx supabase login` from this machine.

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

You can either use a `[env.dev]` section in `apps/api/wrangler.toml` or deploy a separate Worker name. The simplest approach is separate Worker names so secrets stay isolated:

```bash
cd apps/api

# Deploy with dev name
wrangler deploy --name fresno-events-api-dev

# Set dev secrets
wrangler secret put SUPABASE_URL --name fresno-events-api-dev
wrangler secret put SUPABASE_SERVICE_ROLE_KEY --name fresno-events-api-dev
wrangler secret put ADMIN_REVIEW_TOKEN --name fresno-events-api-dev
```

The dev worker will be reachable at `https://fresno-events-api-dev.<account>.workers.dev`. No custom domain needed.

Verify:

```bash
curl -s https://fresno-events-api-dev.<account>.workers.dev/health
```

### A4. Deploy the dev ingest worker

```bash
cd workers/ingest

wrangler deploy --name fresno-events-ingest-dev

wrangler secret put SUPABASE_URL --name fresno-events-ingest-dev
wrangler secret put SUPABASE_SERVICE_ROLE_KEY --name fresno-events-ingest-dev
wrangler secret put ADMIN_REVIEW_TOKEN --name fresno-events-ingest-dev
wrangler secret put TICKETMASTER_API_KEY --name fresno-events-ingest-dev
```

Test a manual run:

```bash
curl -X POST -H "x-admin-token: $DEV_ADMIN_TOKEN" \
  "https://fresno-events-ingest-dev.<account>.workers.dev/trigger?source=ticketmaster&force=true"
```

The Cron Trigger (`0 */4 * * *`) installs automatically. If you only want cron on prod, remove the `[triggers]` section before deploying dev and rely on manual `/trigger` calls instead.

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

Update `apps/api/wrangler.toml` -> `[[r2_buckets]] bucket_name = "fresno-event-images-prod"` for the production deploy.

### B3. API worker (prod)

```bash
cd apps/api
wrangler secret put SUPABASE_URL
wrangler secret put SUPABASE_SERVICE_ROLE_KEY
wrangler secret put ADMIN_REVIEW_TOKEN
# optional:
wrangler secret put R2_PUBLIC_BASE_URL   # e.g. https://images.whatupfresno.com
wrangler deploy
```

Then in the Cloudflare dashboard for the `fresno-events-api` Worker -> Triggers -> Custom Domains, add `api.whatupfresno.com`. DNS will be created automatically.

Verify:

```bash
curl -s https://api.whatupfresno.com/health
```

### B4. Ingest worker (prod)

```bash
cd workers/ingest
wrangler secret put SUPABASE_URL
wrangler secret put SUPABASE_SERVICE_ROLE_KEY
wrangler secret put ADMIN_REVIEW_TOKEN
wrangler secret put TICKETMASTER_API_KEY
# optional, only if you enable these source rows:
wrangler secret put SEATGEEK_CLIENT_ID
wrangler secret put SEATGEEK_CLIENT_SECRET
wrangler secret put EVENTBRITE_API_KEY
wrangler secret put BANDSINTOWN_APP_ID
# optional, AI fallback if you remove the [ai] binding:
wrangler secret put ANTHROPIC_API_KEY
wrangler deploy
```

Cron Triggers come from `wrangler.toml`. Confirm they installed in dashboard -> Workers -> fresno-events-ingest -> Triggers.

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
