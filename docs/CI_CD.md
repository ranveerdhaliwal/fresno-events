# CI/CD

**Workflow:** local dev (`pnpm dev`) → PR + CI → merge `main` → deploy **`whatupfresno.com`**.

---

## What runs where

| Layer | Trigger | How |
|-------|---------|-----|
| **Tests** | PR + push `main` | GitHub Actions [`.github/workflows/ci.yml`](../.github/workflows/ci.yml) |
| **Pages (web)** | push `main` | **Cloudflare Dashboard** — GitHub connection (recommended) |
| **Workers (api + ingest)** | push `main` (after CI passes) | GitHub Actions [`.github/workflows/ci.yml`](../.github/workflows/ci.yml) `deploy-workers` job |

Worker **runtime** secrets (Supabase, API keys, `ADMIN_REVIEW_TOKEN`) stay in Cloudflare — deploy only updates code and `wrangler.toml` bindings.

---

## GitHub Actions — CI

On every PR and push to `main`:

```bash
pnpm install --frozen-lockfile
pnpm typecheck
pnpm lint
pnpm test
```

Gate merges with a branch protection rule requiring the **CI** check.

---

## Cloudflare Pages — web (recommended)

Connect the repo in **Cloudflare Dashboard → Workers & Pages → fresno-events → Settings → Builds**:

| Setting | Value |
|---------|--------|
| Production branch | `main` |
| Build command | `pnpm install && pnpm --filter @fresno-events/web build` |
| Build output directory | `apps/web/dist` |
| Root directory | `/` (repo root) |

**Production environment variables** (Pages → Settings → Environment variables):

- `VITE_API_URL` = `https://api.whatupfresno.com`
- `VITE_GA_MEASUREMENT_ID`
- `VITE_ADSENSE_CLIENT_ID`
- `VITE_ADSENSE_SLOT_*` (when AdSense units exist)

Benefits: no `CLOUDFLARE_API_TOKEN` in GitHub for Pages, build logs and rollback in Cloudflare, auto-deploy on `main`.

`fresno-events.pages.dev` is Cloudflare’s default hostname — **not used** for staging. Canonical site is `whatupfresno.com`.

---

## GitHub Actions — Workers deploy

[`.github/workflows/ci.yml`](../.github/workflows/ci.yml) `deploy-workers` job runs on push to `main` after tests pass:

| Target | Command | Worker |
|--------|---------|--------|
| API | `wrangler deploy --env dev` | `fresno-events-api-dev` |
| Ingest | `wrangler deploy --env dev` | `fresno-events-ingest-dev` |

### GitHub secrets (Workers deploy job)

Add these in **GitHub** (not Cloudflare):

1. Open **https://github.com/ranveerdhaliwal/fresno-events**
2. **Settings** → **Secrets and variables** → **Actions**
3. **New repository secret** for each:

| Secret name | Value | Where to get it |
|-------------|-------|-----------------|
| `CLOUDFLARE_API_TOKEN` | API token string | Cloudflare → **My Profile** (avatar) → **API Tokens** → **Create Token** → use template **Edit Cloudflare Workers** → Create → copy token once |
| `CLOUDFLARE_ACCOUNT_ID` | `b8c559487d24af4a208be0a5584512a9` | Same as `account_id` in `apps/api/wrangler.toml`, or Cloudflare dashboard URL: `dash.cloudflare.com/<account_id>/` |

Token permissions needed: **Account** → Workers Scripts → **Edit**. No Pages permission required if Pages builds via Cloudflare GitHub connection.

After secrets exist, the `deploy-workers` job on push to `main` can run `wrangler deploy --env dev` for API + ingest.

---

## First-time setup checklist

### Step 1 — GitHub Actions secrets (Workers only)

See table above. **Repo → Settings → Secrets and variables → Actions.**

Without these, CI still runs tests on PR/push; only the **deploy-workers** job fails on `main`.

### Step 2 — Connect Cloudflare Pages to GitHub (web)

1. **https://dash.cloudflare.com** → **Workers & Pages** → project **fresno-events** (or create Pages project linked to this repo).
2. **Settings** → **Builds** → **Connect to Git** → authorize GitHub → select **ranveerdhaliwal/fresno-events**.
3. Configure **Production** branch `main`:

| Field | Value |
|-------|--------|
| Framework preset | None (or Vite if offered) |
| Root directory | `/` (repo root) |
| Build command | `pnpm install && pnpm --filter @fresno-events/web build` |
| Build output directory | `apps/web/dist` |

4. **Settings** → **Environment variables** → **Production**:

| Variable | Example value |
|----------|----------------|
| `VITE_API_URL` | `https://api.whatupfresno.com` |
| `VITE_GA_MEASUREMENT_ID` | `G-SP3QWX0EGP` |
| `VITE_ADSENSE_CLIENT_ID` | `ca-pub-1385262226884616` |
| `VITE_ADSENSE_SLOT_*` | (add when AdSense units exist) |

5. Save → **Retry deployment** or push to `main` to trigger first auto-build.

Canonical URL: **whatupfresno.com** (custom domain already attached). Ignore `fresno-events.pages.dev`.

### Step 3 — Verify ingest cron (after Workers deploy)

1. **https://dash.cloudflare.com** → **Workers & Pages** → **fresno-events-ingest-dev**
2. **Triggers** → **Cron Triggers** → expect **2** entries: `0 14 * * 1` and `0 14 * * 4`
3. Optional: **Logs** → **Begin log stream** or `wrangler tail fresno-events-ingest-dev`
4. After Monday/Thursday tick (or manual `/trigger?force=true`): check `ingest_runs` in Supabase and **Admin → New** for `pending_review` rows

### Step 4 — Bootstrap ingest data (if DB not already seeded)

```bash
pnpm ingest:dev   # terminal 1
pnpm ingest:promote --source=ticketmaster
pnpm ingest:promote --source=venunite
pnpm ingest:promote-all
```

### Step 5 — Branch protection (optional but recommended)

**GitHub repo → Settings → Branches → Add rule** for `main`:

- Require pull request before merging
- Require status check: **check** (from `ci.yml`)

### Step 6 — GA / AdSense verification (manual)

1. Browse **https://whatupfresno.com** with [GA4 DebugView](https://analytics.google.com/) open → confirm pageviews.
2. Confirm **https://whatupfresno.com/ads.txt** serves the pub line.
3. In AdSense: connect site → create 4 display units → copy slot IDs into Pages Production env → redeploy.

---

## GitHub Actions — Workers deploy

```bash
# API
cd apps/api && wrangler deploy --env dev

# Ingest
cd workers/ingest && wrangler deploy --env dev

# Web
VITE_API_URL=https://api.whatupfresno.com \
VITE_GA_MEASUREMENT_ID=G-SP3QWX0EGP \
VITE_ADSENSE_CLIENT_ID=ca-pub-1385262226884616 \
pnpm --filter @fresno-events/web build

wrangler pages deploy apps/web/dist --project-name fresno-events --branch main
```

---

## Not auto-deployed

- Supabase migrations — manual (`pnpm db:migrate:cloud-dev`)
- Worker secrets — set once via `wrangler secret put --env dev`
- Separate prod stack (`--env prod`) — deferred

---

## Live site checklist (v1)

Cloud-dev Supabase (`what-up-fresno-dev`) is the **single database** for ingest, admin review, and the public site. Wrangler profile `dev` is the live Workers/Pages stack (`api.whatupfresno.com`, `whatupfresno.com`).

| Item | Status |
| --- | --- |
| API + ingest Workers deployed (`--env dev`) | Done |
| Pages on `whatupfresno.com` | Done |
| Cloud-dev DB migrated + populated | Done |
| Mon/Thu ingest cron | Configured — verify after subrequest-budget deploy |
| GitHub Actions `check` + `deploy-workers` on `main` | Merge pending — requires shared package build step |
| GA / AdSense verification on production domain | Open |
| Workers Paid (optional) | If compact ingest mode (40+ events) is too lossy |

**Architecture:** Pages → `VITE_API_URL` → API Worker → cloud-dev Postgres + R2 `fresno-event-images-dev`. Ingest Worker writes `event_candidates`; `/admin` approve publishes to `events` on the same DB.

---

## Related

- [INGEST_SCHEDULE.md](INGEST_SCHEDULE.md) — Mon/Thu ingest cron
- [DATABASE_ACCESS.md](DATABASE_ACCESS.md) — local vs cloud, push/pull sync
- [INGEST.md](INGEST.md) — ingest overview
