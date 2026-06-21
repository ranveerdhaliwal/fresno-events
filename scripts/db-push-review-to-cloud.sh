#!/usr/bin/env bash
# Replace cloud dev ingest + published tables with a local Postgres dump.
#
# Usage:
#   pnpm db:push-cloud-dev --confirm
#
# --confirm  Required. Wipes cloud dev rows in listed tables and restores from local.
# --yes      Deprecated alias for --confirm.
#
# Requires SUPABASE_DB_PASSWORD_CLOUD_DEV in dev-target.env (Dashboard → Database password).

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
CONFIRM="false"
SKIP_MIGRATE_CHECK="false"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --confirm|--yes) CONFIRM="true" ;;
    --skip-migrate-check) SKIP_MIGRATE_CHECK="true" ;;
    -h|--help)
      cat <<'EOF'
Usage: pnpm db:push-cloud-dev --confirm

Copies local Postgres data to cloud dev (destructive on cloud):

  images, venues, events, event_candidates, ingest_runs

Before push, applies pending migrations to linked cloud dev (supabase migration up --linked)
unless --skip-migrate-check is set.

Flags:
  --confirm              Required — allow truncate + restore on cloud dev
  --yes                  Alias for --confirm (deprecated)
  --skip-migrate-check   Skip linked migration step (not recommended)

Prerequisites:
  pnpm db:start
  SUPABASE_DB_PASSWORD_CLOUD_DEV in dev-target.env
  supabase link to cloud dev project (for migration preflight)
  psql on PATH for cloud restore (or Docker — see script)
  Local dump uses Supabase Docker pg_dump (no host pg_dump required)
EOF
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
  cat >&2 <<'EOF'
Refusing to modify cloud dev without --confirm.

This command TRUNCATES and replaces on cloud dev:
  events, venues, images, event_candidates, ingest_runs

Re-run: pnpm db:push-cloud-dev --confirm
EOF
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

# WSL often has no IPv6 route. Direct db.*.supabase.co is IPv6-only; use session pooler (IPv4).
resolve_ipv4() {
  local host="$1"
  local ip=""
  if command -v getent >/dev/null 2>&1; then
    ip="$(getent ahostsv4 "$host" 2>/dev/null | awk '{ print $1; exit }')"
  fi
  if [[ -z "$ip" ]] && command -v dig >/dev/null 2>&1; then
    ip="$(dig +short A "$host" 2>/dev/null | grep -E '^[0-9.]+$' | head -1)"
  fi
  echo "$ip"
}

build_cloud_pg_uri() {
  local host="$1"
  local user="$2"
  local use_hostaddr="${3:-true}"
  local ipv4=""
  if [[ "$use_hostaddr" == "true" ]]; then
    ipv4="$(resolve_ipv4 "$host")"
  fi
  if [[ -n "$ipv4" ]]; then
    echo "postgresql://${user}:${DB_PASSWORD}@${host}:5432/postgres?sslmode=require&hostaddr=${ipv4}"
  else
    echo "postgresql://${user}:${DB_PASSWORD}@${host}:5432/postgres?sslmode=require"
  fi
}

POOLER_URL_FILE="$REPO_ROOT/supabase/.temp/pooler-url"
CLOUD_DB_HOST=""
CLOUD_DB_IPV4=""
CLOUD_CONNECT_MODE="direct"

if [[ -n "${SUPABASE_DB_POOLER_HOST_CLOUD_DEV:-}" ]]; then
  CLOUD_DB_HOST="$SUPABASE_DB_POOLER_HOST_CLOUD_DEV"
  CLOUD_CONNECT_MODE="pooler"
elif [[ -f "$POOLER_URL_FILE" ]]; then
  CLOUD_DB_HOST="$(sed -n 's|.*@\([^:]*\):[0-9]*/.*|\1|p' "$POOLER_URL_FILE")"
  if [[ -n "$CLOUD_DB_HOST" ]]; then
    CLOUD_CONNECT_MODE="pooler"
  fi
fi

if [[ "$CLOUD_CONNECT_MODE" == "pooler" && -n "$CLOUD_DB_HOST" ]]; then
  CLOUD_PG="$(build_cloud_pg_uri "$CLOUD_DB_HOST" "postgres.${PROJECT_REF}" "false")"
  CLOUD_DB_IPV4="$(resolve_ipv4 "$CLOUD_DB_HOST")"
else
  CLOUD_DB_HOST="db.${PROJECT_REF}.supabase.co"
  CLOUD_DB_IPV4="$(resolve_ipv4 "$CLOUD_DB_HOST")"
  if [[ -z "$CLOUD_DB_IPV4" ]]; then
    cat >&2 <<EOF
Cannot reach cloud Postgres from this machine: ${CLOUD_DB_HOST} is IPv6-only and no IPv4 route (common on WSL).

Fix (pick one):
  1. supabase link --project-ref ${PROJECT_REF}
     (writes supabase/.temp/pooler-url — push will use session pooler automatically)
  2. Set SUPABASE_DB_POOLER_HOST_CLOUD_DEV in dev-target.env
     (Dashboard → Connect → Session pooler → hostname, e.g. aws-1-us-west-1.pooler.supabase.com)
EOF
    exit 1
  fi
  CLOUD_PG="$(build_cloud_pg_uri "$CLOUD_DB_HOST" "postgres")"
fi
DUMP_FILE="$(mktemp /tmp/fresno-cloud-data.XXXXXX.sql)"

run_supabase() {
  if command -v supabase >/dev/null 2>&1; then
    supabase "$@"
  else
    npx supabase "$@"
  fi
}

resolve_local_db_container() {
  if docker exec supabase_db_what-up-fresno pg_isready -U postgres -d postgres >/dev/null 2>&1; then
    echo "supabase_db_what-up-fresno"
    return
  fi
  local name
  name="$(docker ps --filter "name=supabase_db" --format '{{.Names}}' | head -1 || true)"
  if [[ -n "$name" ]] && docker exec "$name" pg_isready -U postgres -d postgres >/dev/null 2>&1; then
    echo "$name"
    return
  fi
  echo ""
}

local_pg_dump() {
  local container="$1"
  shift
  docker exec "$container" pg_dump -U postgres -d postgres "$@"
}

local_psql() {
  local container="$1"
  shift
  docker exec -i "$container" psql -U postgres -d postgres "$@"
}

cloud_psql() {
  if command -v psql >/dev/null 2>&1; then
    psql "$CLOUD_PG" "$@"
    return
  fi
  if ! command -v docker >/dev/null 2>&1; then
    echo "psql not found and Docker unavailable — install postgresql-client or Docker." >&2
    return 1
  fi
  docker run --rm -i -e PGSSLMODE=require postgres:17-alpine psql "$CLOUD_PG" "$@"
}

cleanup() {
  rm -f "$DUMP_FILE"
}
trap cleanup EXIT

cat >&2 <<EOF

CLOUD DEV DATA REPLACE (project ${PROJECT_REF})

  Will TRUNCATE on cloud dev and restore from LOCAL:
    events, venues, images, event_candidates, ingest_runs

  Does NOT touch: prod, seed_urls, auth.users

EOF

LOCAL_DB_CONTAINER="$(resolve_local_db_container)"
if [[ -z "$LOCAL_DB_CONTAINER" ]]; then
  echo "Local Supabase Postgres is not running. Run: pnpm db:start" >&2
  exit 1
fi

if ! command -v psql >/dev/null 2>&1 && ! command -v docker >/dev/null 2>&1; then
  echo "Need psql (postgresql-client) or Docker to restore to cloud dev." >&2
  exit 1
fi

if [[ "$SKIP_MIGRATE_CHECK" != "true" ]]; then
  echo "Checking cloud dev migrations (linked)…" >&2
  cd "$REPO_ROOT"
  if ! run_supabase migration up --linked; then
    cat >&2 <<'EOF'
Cloud dev migration step failed.

Common fix (remote version not in repo — e.g. 20260524033349):
  Ensure supabase/migrations/20260524033349_event_candidates_suggested_priority.sql exists (git pull).
  pnpm db:migrate:cloud-dev

If local migration list still references 20260524000000:
  pnpm db:repair:local-migration-version

Ensure the project is linked:
  supabase link --project-ref mrfkpvbvgzbtcutulfnc

Or re-run with --skip-migrate-check (only if you know schemas already match).
EOF
    exit 1
  fi
  echo "" >&2
else
  echo "WARNING: --skip-migrate-check — not verifying cloud dev schema." >&2
fi

echo "Local:  $LOCAL_PG" >&2
if [[ -n "${CLOUD_DB_IPV4:-}" ]]; then
  echo "Cloud:  ${CLOUD_DB_HOST} (${CLOUD_CONNECT_MODE}, IPv4 ${CLOUD_DB_IPV4})" >&2
else
  echo "Cloud:  ${CLOUD_DB_HOST} (${CLOUD_CONNECT_MODE})" >&2
fi

echo "Dumping local tables (via Docker: ${LOCAL_DB_CONTAINER})…" >&2
local_pg_dump "$LOCAL_DB_CONTAINER" \
  --data-only --no-owner --no-privileges \
  -t public.images \
  -t public.venues \
  -t public.events \
  -t public.event_candidates \
  -t public.ingest_runs \
  >"$DUMP_FILE"

echo "Truncating cloud tables…" >&2
cloud_psql -v ON_ERROR_STOP=1 <<'SQL'
BEGIN;
TRUNCATE public.events CASCADE;
TRUNCATE public.event_candidates;
TRUNCATE public.ingest_runs CASCADE;
TRUNCATE public.venues CASCADE;
TRUNCATE public.images CASCADE;
COMMIT;
SQL

echo "Restoring to cloud…" >&2
cloud_psql -v ON_ERROR_STOP=1 <"$DUMP_FILE"

echo "Row counts:" >&2
local_psql "$LOCAL_DB_CONTAINER" -v ON_ERROR_STOP=1 -c "
SELECT 'local' AS side,
  (SELECT count(*) FROM images) AS images,
  (SELECT count(*) FROM venues) AS venues,
  (SELECT count(*) FROM events) AS events,
  (SELECT count(*) FROM event_candidates) AS candidates,
  (SELECT count(*) FROM ingest_runs) AS runs;"
cloud_psql -v ON_ERROR_STOP=1 -c "
SELECT 'cloud' AS side,
  (SELECT count(*) FROM images) AS images,
  (SELECT count(*) FROM venues) AS venues,
  (SELECT count(*) FROM events) AS events,
  (SELECT count(*) FROM event_candidates) AS candidates,
  (SELECT count(*) FROM ingest_runs) AS runs;"

echo "Done. Run: pnpm env:cloud-dev && restart pnpm dev:api" >&2
