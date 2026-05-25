#!/usr/bin/env bash
# Apply pending supabase/migrations without wiping data.
#
#   pnpm db:migrate              # uses DEV_TARGET from dev-target.env
#   pnpm db:migrate:local        # always local Docker
#   pnpm db:migrate:cloud-dev    # linked cloud dev (supabase link)
#
# Wipe + reseed: pnpm db:reset (local only)

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$REPO_ROOT"

# shellcheck source=scripts/dev-target.sh
source "$REPO_ROOT/scripts/dev-target.sh"

TARGET="${DB_MIGRATE_TARGET:-}"

usage() {
  echo "Usage: pnpm db:migrate | db:migrate:local | db:migrate:cloud-dev" >&2
  echo "  db:migrate         → reads DEV_TARGET from dev-target.env (default: local)" >&2
  echo "  db:migrate:local   → supabase migration up --local" >&2
  echo "  db:migrate:cloud-dev → supabase migration up --linked" >&2
  echo "  db:reset           → drop DB, all migrations, seed.sql (destructive)" >&2
  exit 2
}

if [[ "${1:-}" == "-h" || "${1:-}" == "--help" ]]; then
  usage
fi

if [[ -z "$TARGET" ]]; then
  if [[ -n "${1:-}" ]]; then
    TARGET="$1"
  else
    dev_target_load_file || true
    TARGET="${DEV_TARGET:-local}"
  fi
fi

run_supabase() {
  if command -v supabase >/dev/null 2>&1; then
    supabase "$@"
  else
    npx supabase "$@"
  fi
}

ensure_local_stack() {
  if ! run_supabase status >/dev/null 2>&1; then
    echo "Local Supabase is not running." >&2
    echo "  pnpm db:start    # start Docker stack (data volumes persist across restarts)" >&2
    exit 1
  fi
}

case "$TARGET" in
  local)
    ensure_local_stack
    echo "Applying pending migrations to local Postgres (existing rows kept)…"
    run_supabase migration up --local
    echo ""
    echo "Migration history (local):"
    run_supabase migration list --local
    ;;
  cloud-dev)
    echo "Applying pending migrations to linked cloud dev project…"
    run_supabase migration up --linked
    echo ""
    echo "Migration history (linked):"
    run_supabase migration list --linked
    ;;
  cloud-prod)
    echo "Refusing cloud-prod schema changes from this script." >&2
    echo "Use a reviewed process / MCP with explicit approval." >&2
    exit 1
    ;;
  *)
    echo "Unknown target: $TARGET (use local or cloud-dev)" >&2
    usage
    ;;
esac

echo ""
echo "Done. Restart pnpm dev:api / pnpm ingest:dev if Workers were running."
