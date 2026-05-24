#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
CONTAINER="$(docker ps --filter 'name=supabase_db_' --format '{{.Names}}' | head -1)"

if [[ -z "${CONTAINER}" ]]; then
  echo "No local Supabase DB container found. Run: pnpm db:start" >&2
  exit 1
fi

docker exec -i "${CONTAINER}" psql -U postgres -d postgres < "${ROOT}/supabase/seed.sql"
echo "Seeded local database via ${CONTAINER}"
