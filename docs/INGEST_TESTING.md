# Ingest testing (safe real runs)

**Remaining ingest work:** [INGEST_DISCOVERY_AND_DETAIL_PLAN.md](INGEST_DISCOVERY_AND_DETAIL_PLAN.md)

Cloud dev Studio: [event_candidates table](https://supabase.com/dashboard/project/mrfkpvbvgzbtcutulfnc/editor)

**Which database?** Admin → local API (`VITE_API_URL`) → `apps/api` `SUPABASE_URL`. Ingest uses `workers/ingest` `SUPABASE_URL`. Switch together via `pnpm env:local` or `pnpm env:cloud-dev` (`pnpm env:status` to verify).

## Commands

Venues split into two **lanes** (by `strategy` in each `venue.config.json`):

| Lane | Strategies | Needs Browser Rendering + LLM on promote? |
| --- | --- | --- |
| **direct** | `api`, `html_parse` | No — HTTP/API only (Downtown = CityLight BBQ widget HTML; no BR) |
| **browser** | `listing_then_detail`, `month_windows_then_detail`, `scroll_listing_then_detail` | Yes |

| Command | What it does |
| --- | --- |
| `pnpm ingest:dev` | Start local ingest worker (terminal 1) |
| `pnpm ingest:preflight-direct` | Dry-run **direct** lane (visit, downtown, milb) |
| `pnpm ingest:preflight-browser` | Dry-run **browser** lane (tower, strummers, save-mart, …) |
| `pnpm ingest:preflight-all` | Dry-run **both lanes** (all enabled venues) |
| `pnpm ingest:preflight --venue=<key>` | Dry-run one venue |
| `pnpm ingest:promote-direct` | **Real** direct lane |
| `pnpm ingest:promote-browser` | **Real** browser lane |
| `pnpm ingest:promote-all` | **Real** both lanes |
| `pnpm ingest:promote --venue=<key>` | **Real** one venue |
| `pnpm review:bulk-approve` | Approve all `pending_review` locally |
| `POST /review/candidates/:id/approve-changes` | Apply a single `needs_changes` row to its linked `events` row |
| `POST /review/candidates/bulk-approve-changes` | Bulk approve listed update ids |

**Deprecated aliases:** `ingest:preflight-crawl` / `ingest:promote-crawl` → **browser** lane.

**Preflight vs promote:** separate commands. Preflight = dry-run (no `event_candidates`; venue runs write `venue_ingest_runs` debug).

**Logs:** Preflight and promote print a **source health** table plus a **Preflight summary**: one line per event (`Title… - /event/… - 6/3 6:50p`). Path is clickable (full URL in OSC 8). Set `NO_HYPERLINK=1` for plain text.

**Browser lane in preflight:** Dry-run does **not** run Browser Rendering or detail-page LLM. Server-rendered listings (Strummers, Fulton, Tower) show **planned detail URL counts** as OK. JS-heavy sites (Save Mart, Big Fresno Fair) may show FAIL in preflight even when the site looks fine in a browser — use `pnpm ingest:promote --venue=<key>` or `pnpm ingest:promote-browser` to verify.

## Checklist

1. `pnpm ingest:preflight-direct` then `pnpm ingest:promote-direct` (API + html_parse)
2. `pnpm ingest:preflight-browser` then `pnpm ingest:promote-browser` (BR crawlers)
3. Or `pnpm ingest:preflight-all` / `pnpm ingest:promote-all` for everything at once
4. Studio: filter `event_candidates` by `source`
5. `/admin` — **New** tab for `pending_review`, **Updates** tab for `needs_changes`

## Expected counts (soft warnings)

| Venue key | `event_candidates.source` | Typical count |
| --- | --- | --- |
| `visit-fresno-county` | `api:visitfresnocounty` | ~224 |
| `milb-grizzlies` | `api:milb` | ~88 |
| `downtown-fresno` | `api:downtownfresno` | ~27 |
| `tower-theatre` | `scrape:towertheatre.ticketsauce.com` | varies |

Hard validation fails on duplicate `sourceEventId` in one batch, missing required fields, or errors over budget.

See [VENUE_INGEST.md](VENUE_INGEST.md).
