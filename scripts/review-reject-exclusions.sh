#!/usr/bin/env bash
# Auto-reject queue rows that match shared ingest exclusion rules (away games, Shen Yun, …).
#
# Usage:
#   pnpm review:reject-exclusions
#   pnpm review:reject-exclusions -- --apply
#   pnpm review:reject-exclusions -- --dry-run   # default

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
APPLY="false"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --apply) APPLY="true" ;;
    --dry-run) APPLY="false" ;;
    --) shift; continue ;;
    -h|--help)
      sed -n '2,8p' "$0" | sed 's/^# \{0,1\}//'
      exit 0
      ;;
    *)
      echo "Unknown argument: $1" >&2
      exit 2
      ;;
  esac
  shift || true
done

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

ARGS=()
if [[ "$APPLY" == "true" ]]; then
  ARGS+=(--apply)
fi

exec node "$REPO_ROOT/scripts/review-reject-exclusions.mjs" "${ARGS[@]}"
