# AI crawl (Browser Rendering)

The `ai-crawl` ingest source uses [Cloudflare Browser Rendering `/crawl`](https://developers.cloudflare.com/browser-run/quick-actions/crawl-endpoint/) plus Workers LLM extraction (Gemini / Workers AI / Anthropic).

## Secrets

In `workers/ingest/.dev.vars`:

- `CLOUDFLARE_ACCOUNT_ID`
- `CLOUDFLARE_API_TOKEN` (Browser Rendering — Edit)
- `GEMINI_API_KEY` (or Workers AI binding / `ANTHROPIC_API_KEY`)

## Commands (promote vs preflight)

| Command | What it does |
| --- | --- |
| `pnpm ingest:preflight-crawl` | Dry-run: logs `br_crawl_plan` per URL (**no** BR jobs started) |
| `pnpm ingest:promote-crawl` | Real run: POST crawl → poll `?limit=1` → fetch markdown → LLM → DB |

Preflight and promote are **separate** on purpose. Old behavior ran dry-run BR crawls during preflight, which doubled cost.

## Run modes (`ingest:run`)

| Flag | DB writes | Browser Rendering |
| --- | --- | --- |
| `--force` | Yes | Starts jobs per `seed_urls` + `crawl_hints` |
| `--dry-run --force` | No | **Plan only** — logs limit/depth/URLs, no POST |
| `--resume-jobs --force` | Yes | Polls existing `br_crawl_job_id` only |

## How we match the Cloudflare docs

1. **Start** — `POST .../browser-rendering/crawl` → job id ([initiate](https://developers.cloudflare.com/browser-run/quick-actions/crawl-endpoint/#initiate-the-crawl-job))
2. **Poll** — `GET .../crawl/{id}?limit=1` until status ≠ `running` ([polling](https://developers.cloudflare.com/browser-run/quick-actions/crawl-endpoint/#polling-for-completion))
3. **Results** — `GET .../crawl/{id}?status=completed` with cursor pagination
4. **Cancel** — `DELETE .../crawl/{id}` on client abort ([cancel](https://developers.cloudflare.com/browser-run/quick-actions/crawl-endpoint/#cancel-a-crawl-job))

Shallow crawls use `limit: 1`, `depth: 0` for listing-page seeds. TicketSauce uses monthly `?start=&end=` windows (six shallow jobs per seed).

## Cancel / Ctrl+C

- **API scrapers** — stopping the worker aborts in-flight `fetch`; nothing keeps running remotely.
- **ai-crawl** — BR jobs are async on Cloudflare. If the ingest request is aborted (curl disconnect), we call `DELETE` on the active job id when possible.
- **Stopping `pnpm ingest:dev` (wrangler)** — may kill the Worker before cancel runs; a job can keep running until timeout. Check Cloudflare dashboard or re-run with `--resume-jobs` / wait for `br_crawl_incomplete`.

## Seeds

Venue URLs live in `public.seed_urls` (`lane = crawl`). Each row has `crawl_hints.provider`: `listing_page`, `ticketsauce`, `festival`, `headline_only`.

## Gotchas

- Poll cap: 8 minutes per target per invocation; use `--resume-jobs` if a job outlives the Worker.
- Job results retained **14 days** on Cloudflare ([docs](https://developers.cloudflare.com/browser-run/quick-actions/crawl-endpoint/#request-results-of-the-crawl-job)).
- `rejectResourceTypes` includes `stylesheet` — drop it if markdown is empty on SPAs.
