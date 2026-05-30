# Local dev logging (external terminals)

API, web, and ingest run in **your** terminals — Cursor agents cannot read those streams unless you paste them or tee to a file.

## API (`pnpm dev:api`)

Structured JSON logs include Pacific timestamps:

```json
{"ts":"05/26/2026, 11:38:51 AM","tz":"America/Los_Angeles","event":"bulk_approve_item_failed","level":"error",...}
```

Request lines:

```text
[05/26/2026, 11:38:51 AM PT] --> POST /review/candidates/bulk-approve
[05/26/2026, 11:38:58 AM PT] <-- POST /review/candidates/bulk-approve 200
```

Errors to watch for: `bulk_approve_item_failed`, `review_route_error`, `supabase_review_request_failed`, `image_mirror_failed`, `event_slug_conflict_retry`.

### Optional log file

```bash
pnpm dev:api 2>&1 | tee /tmp/fresno-api.log
```

Share `/tmp/fresno-api.log` or paste the `bulk_approve_item_failed` / `review_route_error` lines when debugging.

## Web / ingest

Use the same `tee` pattern if you need shareable logs. Ingest worker logs enrichment and scrape phases to stdout.

### Ingest persist audit (JSON)

After candidate upserts, look for:

```json
{"event":"ingest_candidate_new","source_event_id":"…","title":"…"}
{"event":"ingest_candidate_changed","source_event_id":"…","changed_fields":["title","startTs"],…}
{"event":"ingest_persist_summary","new":3,"changed":1,"unchanged":42}
```

Preflight (dry run) ends with the same shape, without writes:

```json
{"event":"ingest_preflight_summary","dry_run":true,"new":2,"changed":4,"unchanged":318,"new_items":[…],"changed_items":[…]}
```

Human line: `[ingest] preflight preview: +2 new, ~4 changed, =318 unchanged (no DB writes).`

The summary is also written to `ingest_runs.metrics.audit` for real promote runs. Re-scrape changes on already-approved events land in `needs_changes` without patching live `events` until admin approve-changes.
