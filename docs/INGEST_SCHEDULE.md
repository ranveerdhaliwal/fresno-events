# Ingest schedule (cloud-dev)

Canonical schedule for the **live ingest worker** (`fresno-events-ingest-dev`). Scraping runs on cloud-dev Supabase only — not on a separate prod stack.

**Overview:** [INGEST.md](INGEST.md) · **Testing:** [INGEST_TESTING.md](INGEST_TESTING.md) · **Venues:** [VENUE_INGEST.md](VENUE_INGEST.md)

---

## Schedule

**Monday and Thursday at 6:00 America/Los_Angeles** — same job both days.

| What runs | Sources |
|-----------|---------|
| Full promote pipeline | `ticketmaster`, `venunite`, `venue-ingest` (all 12 enabled venues) |

No per-day profiles. No Ticketmaster date-window slicing. No source skipped on Thursday.

### Per-source pipeline (already in code)

| Source | Steps |
|--------|--------|
| **venue-ingest** | scrape → persist → Eventbrite detail → ticket-site detail → AI enrich → `pending_review` (per venue) |
| **ticketmaster** | scrape → persist → global AI enrich → `pending_review` |
| **venunite** | scrape → persist → global AI enrich → `pending_review` |

Cron mirrors manual `/trigger` with `--force`: ingest all runnable sources, then `runPostIngestEnrichment` for API-scraper backlog (venue rows already enriched in-venue).

Implementation: [`scheduled-ingest.utils.ts`](../workers/ingest/src/scheduled-ingest.utils.ts) · [`workers/ingest/wrangler.toml`](../workers/ingest/wrangler.toml) `[env.dev.triggers]`

---

## Cloudflare setup

Crons live on the **ingest Worker only** — not Pages or the API Worker.

| Step | Action |
|------|--------|
| 1 | Cron expressions in [`workers/ingest/wrangler.toml`](../workers/ingest/wrangler.toml) → `[env.dev.triggers]` |
| 2 | `cd workers/ingest && wrangler deploy --env dev` |
| 3 | Dashboard → Workers & Pages → **fresno-events-ingest-dev** → **Triggers** → confirm 2 cron triggers |
| 4 | Logs: `wrangler tail fresno-events-ingest-dev` — look for `trigger: "scheduled"` |

### Cron expressions (UTC)

Wrangler accepts UTC only; Pacific time shifts with DST.

| Cron (UTC) | Local intent |
|------------|--------------|
| `0 14 * * 1` | Monday ~6am PT (7am PDT) |
| `0 14 * * 4` | Thursday ~6am PT (7am PDT) |

---

## Bootstrap (once, before first cron)

Cron maintains freshness; it does not seed an empty database.

1. Ensure cloud-dev secrets are set on the ingest worker (`wrangler secret put … --env dev`).
2. Run a full manual promote:
   ```bash
   pnpm ingest:promote --source=ticketmaster
   pnpm ingest:promote --source=venunite
   pnpm ingest:promote-all   # all venue modules
   ```
3. Approve candidates in `/admin` as needed.

---

## Manual override

Always available — ignores cron cadence:

```bash
pnpm ingest:promote --source=ticketmaster
pnpm ingest:promote --source=strummers
pnpm ingest:promote-all
```

Or POST `/trigger?force=true` on the ingest worker (requires `ADMIN_REVIEW_TOKEN`).

---

## Verification after deploy

1. Dashboard shows **2** cron triggers on `fresno-events-ingest-dev`.
2. `GET /health` on ingest lists runnable sources with `lastRunAt`.
3. After a tick (or manual `/trigger?force=true`):
   - `ingest_runs` has rows for `ticketmaster`, `venunite`, `venue-ingest`.
   - Admin **New** tab shows `pending_review` rows (not stuck at `awaiting_enrichment`).
4. Logs include `ingest_run` with `trigger: "scheduled"` and `ingest_post_enrichment`.

---

## Runtime notes

- Monday/Thursday batch = Ticketmaster + Venunite + 12 venues; browser-lane venues can run long.
- Watch Worker CPU/time limits; partial completion is acceptable for v1.
- Venunite Eventbrite URLs blocked from Cloudflare egress may need local recovery: `pnpm eventbrite:detail --limit=5`.

---

## Not in scope

- Prod ingest cron (`[env.prod]` has no triggers)
- `fresno-events.pages.dev` — default Pages URL; not used for ingest
- Per-source cadence gating on cron ticks (`force: true` runs everything)
