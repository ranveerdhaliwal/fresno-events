#!/usr/bin/env bash
# Audit pending_review primaries for event slug collisions before bulk approve.
set -euo pipefail

CONTAINER="${SUPABASE_DB_CONTAINER:-supabase_db_what-up-fresno}"

if ! docker ps --format '{{.Names}}' | grep -qx "$CONTAINER"; then
  echo "Local Supabase DB container not running ($CONTAINER)." >&2
  exit 1
fi

PENDING_JSON="$(
  docker exec "$CONTAINER" psql -U postgres -d postgres -t -A -c "
    SELECT coalesce(json_agg(row_to_json(t)), '[]'::json)
    FROM (
      SELECT id, title, start_ts::text AS \"startTs\", occurrence_id AS \"occurrenceId\"
      FROM event_candidates
      WHERE status = 'pending_review' AND canonical_candidate_id IS NULL
      ORDER BY start_ts, title
    ) t;
  "
)"

EVENTS_JSON="$(
  docker exec "$CONTAINER" psql -U postgres -d postgres -t -A -c "
    SELECT coalesce(json_agg(row_to_json(t)), '[]'::json)
    FROM (
      SELECT id, slug, occurrence_id AS \"occurrenceId\", title
      FROM events
      WHERE status = 'scheduled'
    ) t;
  "
)"

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$REPO_ROOT/apps/api"

AUDIT_PENDING_JSON="$PENDING_JSON" AUDIT_EVENTS_JSON="$EVENTS_JSON" pnpm exec vitest run src/routes/review-slug-audit.integration.test.ts
