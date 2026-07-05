# Ingest local ops — master guide

**Use this when Cloudflare Workers free tier cannot run the full pipeline.** Local `wrangler dev` has no ~50 subrequest cap and no cron CPU wall; it still writes to **cloud-dev Supabase** when `DEV_TARGET=cloud-dev`.

Related: [INGEST.md](INGEST.md) · [INGEST_TESTING.md](INGEST_TESTING.md) · [DATABASE_ACCESS.md](DATABASE_ACCESS.md)

---

## Cloud Workers free tier — what we can and cannot fix

| Limit | Free tier | In-repo mitigations | Still broken on cloud |
| --- | --- | --- | --- |
| **~50 external subrequests** per invocation | Hard cap | TM page cap (5), compact occurrence fetch (40+ events), skip published-event sync, batch caps | **venue-ingest** (12 venues × scrape + detail + enrich) blows the budget |
| **CPU / wall time** on cron | ~few seconds effective | None for full pipeline | Cron dies mid–Big Fresno Fair; `ingest_runs` stuck `running` |
| **Stale cron schedule** | Dashboard may differ from `wrangler.toml` | Redeploy `wrangler deploy --env dev` | Observed `0 */4 * * *` instead of Mon/Thu `0 14 * * 1,4` |
| **Cadence planner** on old deploys | — | Current code uses `force: true` in `runScheduledIngest` | Old deploy logs “No sources due or runnable” |

**Verdict:** Ticketmaster-only `/trigger` can work on cloud **after** subrequest-budget deploy. **Full promote + enrich + detail backfill cannot reliably run on free tier.** Run locally; optionally **disable ingest crons** in Cloudflare dashboard to avoid partial/failed runs.

**Workers Paid ($5/mo):** raises subrequest/CPU limits — only upgrade path if you want cloud cron again without splitting jobs.

**Do not use** `db:push-cloud-dev` after a local run unless you intentionally want to **replace** cloud tables from local Docker. With `pnpm env:cloud-dev`, local ingest writes **directly** to cloud-dev Postgres — no push step.

---

## One-time setup

```bash
pnpm install
pnpm env:cloud-dev          # DEV_TARGET=cloud-dev in dev-target.env
pnpm env:status             # SUPABASE_URL → *.supabase.co
```

Secrets live in `dev-target.env` (gitignored). Regenerate worker env after edits: `pnpm env:cloud-dev`.

**AI enrichment locally:** `pnpm env:cloud-dev` sets `APP_ENV=dev` in `.dev.vars`. Local `wrangler dev --local` cannot call the Workers AI binding — ensure `GEMINI_API_KEY` is set in `dev-target.env` (code prefers Gemini when `APP_ENV=dev` + key). Use `--no-enrich` on promote steps, then `pnpm ingest:enrich --all` once at the end.

---

## Standard pipeline (Mon/Thu or after a gap)

**Terminal 1 — keep running:**

```bash
pnpm ingest:dev
```

**Terminal 2 — API (needed for orphan cleanup step 8):** start once before that step, or keep it running:

```bash
pnpm dev:api
```

**Terminal 2 (or 3) — run in order:**

| Step | Command | What it does |
| --- | --- | --- |
| 1 | `pnpm ingest:promote --source=ticketmaster --no-enrich` | TM Discovery API → `event_candidates` |
| 2 | `pnpm ingest:promote --source=venunite --no-enrich` | VenuNite API → candidates |
| 3 | `pnpm ingest:promote-all --no-enrich` | All 12 venue modules (scrape + in-venue detail + enrich) |
| 4 | `pnpm ingest:detail-backfill --all` | Visit Fresno / ticket-site detail pages → price & address |
| 5 | `pnpm ingest:enrich --all` | AI enrich backlog → `pending_review` |
| 6 | `pnpm db:backfill-addresses` | Normalize venue addresses / geocode gaps |
| 7 | `pnpm ingest:relink --dry-run` then `pnpm ingest:relink` | Recompute `occurrence_key` / `occurrence_id` and cross-source duplicate links on **all** candidates (requires `pnpm ingest:dev`) |
| 8 | Orphan cleanup — preview then apply (requires `pnpm dev:api`) | Remove duplicate **published** `events` rows (same title, venue, start); see below |

**Step 8 — orphan cleanup (pick one):**

```bash
# CLI (preview)
curl -X POST "http://127.0.0.1:8790/review/ops/published-orphan-cleanup?dry_run=true" \
  -H "x-admin-token: $ADMIN_REVIEW_TOKEN"

# CLI (apply)
curl -X POST "http://127.0.0.1:8790/review/ops/published-orphan-cleanup" \
  -H "x-admin-token: $ADMIN_REVIEW_TOKEN"
```

Or in **`/admin` → Queue maintenance → Published orphan cleanup** → **Preview**, then **Clean up**.

Run step 7 after every full promote (re-promote alone does not refresh stale `occurrence_id` on existing rows). Run step 8 after relink and **before** bulk approve when sources were approved in different orders — otherwise pre-approve audit may flag `published_content_duplicate`. See [CROSS_SOURCE_DEDUPE.md](CROSS_SOURCE_DEDUPE.md).

**Then:** review queue (see **Cursor review** below) → `pnpm review:bulk-approve` or `/admin`.

### One command (`pnpm ingest:scheduled-local`)

Runs the full table above (steps 1–8), starts ingest + API workers if needed, and writes a **Cursor review manifest** next to the log:

```bash
pnpm ingest:scheduled-local
# Log:     /tmp/fresno-ingest-scheduled/run-<stamp>.log
# Review:  /tmp/fresno-ingest-scheduled/run-<stamp>-cursor-review.txt
```

**Maintenance safety (steps 7–8):**

| Step | Preview | Apply |
| --- | --- | --- |
| Relink | `pnpm ingest:relink --dry-run` — abort apply if errors > 0 | `pnpm ingest:relink` |
| Orphan cleanup | `pnpm review:orphan-cleanup --dry-run` | Only when `wouldDelete > 0`; aborted when over `INGEST_SCHEDULED_MAX_ORPHAN_DELETE` (default **50**) unless `INGEST_SCHEDULED_FORCE_ORPHAN=1` |

Skip maintenance: `INGEST_SCHEDULED_SKIP_MAINTENANCE=1 pnpm ingest:scheduled-local`

The script exits non-zero if maintenance preview/apply fails — read the cursor review manifest before bulk approve.

---

## Cursor review (instead of only `/admin`)

After ingest finishes, use **Cursor Agent** on the Mac mini (or dev machine) to vet the queue before bulk approve. The agent can query cloud-dev via Supabase MCP and apply rejects/fixes you’d do by hand.

**Prerequisites:** `pnpm env:cloud-dev`. `ingest:scheduled-local` starts ingest + API workers automatically.

**After `pnpm ingest:scheduled-local` — read the review manifest first:**

> Open `/tmp/fresno-ingest-scheduled/run-<stamp>-cursor-review.txt` and the matching `.log`. For each `>>>` step, confirm preflight/validation ok, relink `errors=0`, orphan `wouldDelete` matches expectations (and is under the max), no `ingest_runs` stuck `running`. Then query cloud-dev `event_candidates` where `status = 'pending_review'`. Reject out-of-area away games (Go Bulldogs with venue `"City, CA"`). Fix home Fresno State games to Bulldog Soccer Stadium. If maintenance and queue look good, run `pnpm review:bulk-approve`.

**Manual pipeline — example prompt:**

> Query cloud-dev `event_candidates` where `status = 'pending_review'`. Reject out-of-area away games (Go Bulldogs with venue `"City, CA"`). Fix home Fresno State games to Bulldog Soccer Stadium with address `5250 N Barton Ave`. Flag rows missing coords, price, or images. Then run `pnpm review:bulk-approve` if the rest looks good.

The agent can run the same SQL/API steps as this doc; you stay in one thread instead of clicking through 180+ rows in `/admin`.

**When to use `/admin` instead:** spot-check UI, edit a single row, or approve a subset with human eyes on cards/map pins.

### Optional: Cursor SDK after ingest (Mac mini)

You *can* chain review after `ingest:scheduled-local` with the [Cursor SDK](https://cursor.com/docs/sdk) (`Agent.prompt` + `CURSOR_API_KEY`). Example shape:

```typescript
// scripts/ingest-review-agent.example.mts — not wired by default
import { Agent } from "@cursor/sdk";

const result = await Agent.prompt(
  `Repo: fresno-events. DEV_TARGET=cloud-dev. Query pending_review via Supabase MCP or psql. ` +
    `Reject Go Bulldogs away games (venue ends with ", CA"). Fix home games to Bulldog Soccer Stadium. ` +
    `If queue looks good, run pnpm review:bulk-approve.`,
  { apiKey: process.env.CURSOR_API_KEY!, local: { cwd: process.cwd() } }
);
```

**Worth it now?** Probably **not yet** — adds API cost, needs Supabase MCP or SQL credentials in the agent environment, and unattended bulk-approve is risky. **Better for now:** `launchd` runs ingest only; you (or a manual Cursor chat) vet before approve. Revisit SDK when the queue rules are stable enough to codify in a fixed prompt.

---

## Scheduling (Mac mini 24/7)

Cloudflare cron is **not required**. Cursor does **not** replace a system scheduler for local ingest.

| Approach | Cursor app open? | Missed run behavior |
| --- | --- | --- |
| **macOS `launchd` / `cron`** (recommended) | No | Runs on schedule; logs to `/tmp/fresno-ingest.log` |
| **GitHub Actions `schedule`** | No | Runs in CI VM; needs repo secrets |
| **Cursor Automations** (cloud agent) | No | Cloud VM on schedule; secrets in automation UI; fragile for 30–60 min ingest |
| **Cursor local agent** | Yes (or headless SDK) | Manual — **no “catch up when Cursor opens”** for missed cron |

### Recommended: Mac mini `launchd` (Mon & Thu 6:15am PT)

```xml
<!-- ~/Library/LaunchAgents/com.whatupfresno.ingest.plist -->
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key><string>com.whatupfresno.ingest</string>
  <key>ProgramArguments</key>
  <array>
    <string>/bin/bash</string>
    <string>-lc</string>
    <string>cd /path/to/fresno-events && /usr/bin/flock -n /tmp/fresno-ingest.lock pnpm ingest:scheduled-local</string>
  </array>
  <key>StartCalendarInterval</key>
  <array>
    <dict><key>Weekday</key><integer>1</integer><key>Hour</key><integer>6</integer><key>Minute</key><integer>15</integer></dict>
    <dict><key>Weekday</key><integer>4</integer><key>Hour</key><integer>6</integer><key>Minute</key><integer>15</integer></dict>
  </array>
  <key>StandardOutPath</key><string>/tmp/fresno-ingest.log</string>
  <key>StandardErrorPath</key><string>/tmp/fresno-ingest.log</string>
</dict>
</plist>
```

Load: `launchctl load ~/Library/LaunchAgents/com.whatupfresno.ingest.plist`

**Optional follow-up:** a second `launchd` job 30–60 minutes later that opens Cursor CLI / runs a short Agent prompt to vet + `pnpm review:bulk-approve` — only if you automate secrets and accept unattended approve.

### Cursor Automations (cloud)

[Cursor Automations](https://cursor.com/docs) can run a **scheduled cloud agent** on Mon/Thu even when the IDE is closed. Downsides for ingest: `dev-target.env` is gitignored (secrets must live in automation env), long runtime, no local `wrangler --local`. Better for “run tests / triage PR” than full promote. Use **Mac `launchd` + `ingest:scheduled-local`** for this repo.

### A. WSL / Linux `cron` (simple)

| Command | When |
| --- | --- |
| `pnpm ingest:preflight --source=<key>` | Dry-run before first time on a source |
| `pnpm ingest:preflight-all` | Dry-run all venues |
| `pnpm ingest:relink` | After full promote — recompute occurrence keys and cross-source links (step 7; `--dry-run` first) |
| `pnpm review:orphan-cleanup` | Published orphan cleanup — `--dry-run` first; wired into `ingest:scheduled-local` |
| `pnpm eventbrite:detail --limit=10` | Eventbrite URL rows still missing detail |
| `pnpm priority:rerank -- --apply` | Recompute display priority on candidates/events |
| `pnpm review:bulk-approve` | After Cursor or `/admin` vetting — approve all remaining pending |

### Single venue

```bash
pnpm ingest:promote --source=strummers
pnpm ingest:sources    # list keys
```

---

## Environment targets

| `DEV_TARGET` | Ingest writes to | Push/pull |
| --- | --- | --- |
| `local` | Docker Postgres | `db:push-cloud-dev` after local approve |
| `cloud-dev` | **what-up-fresno-dev** (live site DB) | Usually neither — writes are live |
| `cloud-prod` | prod (avoid unless intentional) | — |

Switch: `pnpm env:local` | `pnpm env:cloud-dev` — restart `pnpm ingest:dev` and `pnpm dev:api`.

---

## Scheduling locally (legacy cron one-liner)

### A. WSL / Linux `cron` (simple)

```cron
# Mon & Thu 6:15am Pacific — full cloud-dev refresh
15 6 * * 1,4 cd /home/ranveer/app/fresno-events && /usr/bin/flock -n /tmp/fresno-ingest.lock bash scripts/ingest-scheduled-local.sh >> /tmp/fresno-ingest.log 2>&1
```

Use `CRON_TZ=America/Los_Angeles` if your cron daemon supports it, or convert to UTC (13:15 or 14:15 UTC depending on DST).

### B. GitHub Actions `schedule` (machine always off locally)

Add a workflow that runs on `schedule:` + `workflow_dispatch:`, checks out repo, loads secrets (`DEV_TARGET`, Supabase keys, API keys), starts ingest worker in background, runs `scripts/ingest-scheduled-local.sh`. Needs repo secrets and ~30–60 min job timeout.

### C. Manual

Run the terminal-2 table twice weekly when you remember.

---

## Health checks after a run

```bash
# Cloud dev SQL (Supabase MCP or dashboard)
SELECT status, count(*) FROM event_candidates GROUP BY 1;
SELECT source, started_at, status, events_found FROM ingest_runs ORDER BY started_at DESC LIMIT 10;
```

```bash
# Orphan cleanup should be clean before bulk approve (API on :8790)
curl -X POST "http://127.0.0.1:8790/review/ops/published-orphan-cleanup?dry_run=true" \
  -H "x-admin-token: $ADMIN_REVIEW_TOKEN"
# Expect: wouldDelete: 0
```

Expect: `pending_review` > 0 after enrich; no long-lived `ingest_runs.status = 'running'`; relink `errors: 0`; orphan preview `wouldDelete: 0` (or apply cleanup until it is).

---

## Cloud ingest worker (optional / TM-only)

If subrequest-budget code is deployed, manual cloud trigger works for TM alone:

```bash
curl -H "Authorization: Bearer $ADMIN_REVIEW_TOKEN" \
  "https://fresno-events-ingest-dev.mythlegendx.workers.dev/trigger?source=ticketmaster&force=true"
```

Do **not** rely on this for `promote-all` on free tier.
