#!/usr/bin/env bash
# One-time fix when local schema_migrations still has 20260524000000 but the repo
# file was renamed to 20260524033349 (matches cloud dev MCP history).
#
# Usage: pnpm db:repair:local-migration-version

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
CONTAINER="${LOCAL_DB_CONTAINER:-supabase_db_what-up-fresno}"

if ! docker exec "$CONTAINER" pg_isready -U postgres -d postgres >/dev/null 2>&1; then
  name="$(docker ps --filter "name=supabase_db" --format '{{.Names}}' | head -1 || true)"
  if [[ -n "$name" ]]; then
    CONTAINER="$name"
  else
    echo "Local Supabase Postgres is not running. Run: pnpm db:start" >&2
    exit 1
  fi
fi

docker exec -i "$CONTAINER" psql -U postgres -d postgres -v ON_ERROR_STOP=1 <<'SQL'
DELETE FROM supabase_migrations.schema_migrations
WHERE version = '20260524000000';

INSERT INTO supabase_migrations.schema_migrations (version, name, statements)
VALUES ('20260524033349', 'event_candidates_suggested_priority', ARRAY[]::text[])
ON CONFLICT (version) DO NOTHING;
SQL

echo "Local migration history aligned to 20260524033349 (container: $CONTAINER)." >&2
