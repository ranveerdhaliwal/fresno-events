#!/usr/bin/env bash
# Replace cloud dev ingest_runs + event_candidates with a local Postgres dump.
#
# Usage:
#   pnpm db:push-cloud-dev --yes
#
# Requires SUPABASE_DB_PASSWORD_CLOUD_DEV in dev-target.env (Dashboard → Database password).

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
CONFIRM="false"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --yes) CONFIRM="true" ;;
    -h|--help)
      echo "Usage: pnpm db:push-cloud-dev --yes" >&2
      exit 0
      ;;
    *)
      echo "Unknown argument: $1" >&2
      exit 2
      ;;
  esac
  shift || true
done

if [[ "$CONFIRM" != "true" ]]; then
  echo "Refusing to truncate cloud tables without --yes" >&2
  exit 2
fi

# shellcheck source=scripts/dev-target.sh
source "$REPO_ROOT/scripts/dev-target.sh"
dev_target_load_file || exit 1

CLOUD_URL="${SUPABASE_URL_CLOUD_DEV:-}"
DB_PASSWORD="${SUPABASE_DB_PASSWORD_CLOUD_DEV:-}"
LOCAL_PG="${DATABASE_URL_LOCAL:-postgresql://postgres:postgres@127.0.0.1:54322/postgres}"

if [[ -z "$CLOUD_URL" ]]; then
  echo "SUPABASE_URL_CLOUD_DEV is empty in dev-target.env" >&2
  exit 1
fi

if [[ -z "$DB_PASSWORD" ]]; then
  echo "SUPABASE_DB_PASSWORD_CLOUD_DEV is empty — add Database password from Supabase dashboard." >&2
  exit 1
fi

if [[ "$CLOUD_URL" == *"prod"* ]] && [[ "${ALLOW_PROD_PUSH:-}" != "1" ]]; then
  echo "Cloud URL looks like prod; set ALLOW_PROD_PUSH=1 to override." >&2
  exit 1
fi

PROJECT_REF="$(echo "$CLOUD_URL" | sed -n 's|https://\([^.]*\)\.supabase\.co.*|\1|p')"
if [[ -z "$PROJECT_REF" ]]; then
  echo "Could not parse project ref from SUPABASE_URL_CLOUD_DEV=$CLOUD_URL" >&2
  exit 1
fi

CLOUD_PG="postgresql://postgres:${DB_PASSWORD}@db.${PROJECT_REF}.supabase.co:5432/postgres"
DUMP_FILE="$(mktemp /tmp/fresno-review-data.XXXXXX.sql)"

cleanup() {
  rm -f "$DUMP_FILE"
}
trap cleanup EXIT

echo "Local:  $LOCAL_PG" >&2
echo "Cloud:  db.${PROJECT_REF}.supabase.co (truncate + restore)" >&2

if ! docker exec supabase_db_what-up-fresno pg_isready -U postgres -d postgres >/dev/null 2>&1; then
  echo "Local Supabase Postgres is not running. Run: pnpm db:start" >&2
  exit 1
fi

command -v pg_dump >/dev/null 2>&1 || { echo "pg_dump not found" >&2; exit 1; }
command -v psql >/dev/null 2>&1 || { echo "psql not found" >&2; exit 1; }

echo "Dumping local review tables…" >&2
pg_dump "$LOCAL_PG" \
  --data-only --no-owner --no-privileges \
  -t public.ingest_runs \
  -t public.event_candidates \
  -f "$DUMP_FILE"

echo "Truncating cloud review tables…" >&2
psql "$CLOUD_PG" -v ON_ERROR_STOP=1 <<'SQL'
BEGIN;
TRUNCATE public.event_candidates;
TRUNCATE public.ingest_runs CASCADE;
COMMIT;
SQL

echo "Restoring to cloud…" >&2
psql "$CLOUD_PG" -v ON_ERROR_STOP=1 -f "$DUMP_FILE"

echo "Row counts:" >&2
psql "$LOCAL_PG" -v ON_ERROR_STOP=1 -c "SELECT 'local' AS side, (SELECT count(*) FROM event_candidates) AS candidates, (SELECT count(*) FROM ingest_runs) AS runs;"
psql "$CLOUD_PG" -v ON_ERROR_STOP=1 -c "SELECT 'cloud' AS side, (SELECT count(*) FROM event_candidates) AS candidates, (SELECT count(*) FROM ingest_runs) AS runs;"

echo "Done. Run: pnpm env:cloud-dev && restart pnpm dev:api" >&2
