#!/usr/bin/env bash
# Deterministic editorial priority pass on pending_review primaries (no LLM).
#
# Examples:
#   pnpm admin:priority-triage --dry-run
#   pnpm admin:priority-triage
#   pnpm admin:priority-triage --source=venunite

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

exec node "$REPO_ROOT/scripts/admin-priority-triage.mjs" "$@"
