#!/usr/bin/env bash
# Re-rank display priority on pending candidates and published events (shared rule engine).
#
# Examples:
#   pnpm priority:rerank              # dry-run (both tables)
#   pnpm priority:rerank -- --apply     # write changes
#   pnpm priority:rerank -- --apply --events-only

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"

DEV_VARS="$REPO_ROOT/workers/ingest/.dev.vars"
if [[ -f "$DEV_VARS" ]]; then
  while IFS= read -r line; do
    [[ "$line" =~ ^(SUPABASE_URL|SUPABASE_SERVICE_ROLE_KEY)= ]] || continue
    key="${line%%=*}"
    val="${line#*=}"
    val="${val%\"}"
    val="${val#\"}"
    export "$key=$val"
  done < "$DEV_VARS"
fi

pnpm --filter @fresno-events/shared build
exec node "$REPO_ROOT/scripts/priority-rerank.mjs" "$@"
