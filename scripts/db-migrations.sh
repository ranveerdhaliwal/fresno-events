#!/usr/bin/env bash
# Show which migrations are applied (local and/or linked remote).

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$REPO_ROOT"

# shellcheck source=scripts/dev-target.sh
source "$REPO_ROOT/scripts/dev-target.sh"

SCOPE="${1:-all}"

run_supabase() {
  if command -v supabase >/dev/null 2>&1; then
    supabase "$@"
  else
    npx supabase "$@"
  fi
}

dev_target_load_file 2>/dev/null || true
echo "DEV_TARGET=${DEV_TARGET:-unknown} (from dev-target.env)"
echo ""

case "$SCOPE" in
  local)
    run_supabase migration list --local
    ;;
  cloud-dev|linked)
    run_supabase migration list --linked
    ;;
  all)
    echo "=== Local ==="
    if run_supabase status >/dev/null 2>&1; then
      run_supabase migration list --local
    else
      echo "  (stack not running — pnpm db:start)"
    fi
    echo ""
    echo "=== Linked cloud dev ==="
    run_supabase migration list --linked 2>/dev/null || echo "  (not linked or CLI auth missing)"
    ;;
  *)
    echo "Usage: pnpm db:migrations [local|cloud-dev|all]" >&2
    exit 2
    ;;
esac
