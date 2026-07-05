#!/usr/bin/env bash
# Preview or apply published orphan cleanup via the review API.
#
# Usage:
#   pnpm review:orphan-cleanup --dry-run
#   pnpm review:orphan-cleanup
#
# Prerequisite: pnpm dev:api (or scheduled-local starts API automatically)

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
# shellcheck source=scripts/dev-ports.env
source "$REPO_ROOT/scripts/dev-ports.env"

DRY_RUN="false"
API_ORIGIN="http://127.0.0.1:${FRESNO_API_PORT:-8790}"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --dry-run) DRY_RUN="true" ;;
    -h|--help)
      sed -n '2,12p' "$0" | sed 's/^# \{0,1\}//'
      exit 0
      ;;
    *)
      echo "Unknown argument: $1" >&2
      exit 2
      ;;
  esac
  shift || true
done

# shellcheck source=scripts/ingest-lib.sh
source "$REPO_ROOT/scripts/ingest-lib.sh"
ingest_load_admin_token

if ! curl -fsS "${API_ORIGIN}/health" >/dev/null 2>&1; then
  echo "Review API not reachable at ${API_ORIGIN}. Start: pnpm dev:api" >&2
  exit 1
fi

query=""
if [[ "$DRY_RUN" == "true" ]]; then
  query="?dry_run=true"
fi

url="${API_ORIGIN}/review/ops/published-orphan-cleanup${query}"
echo "POST $url" >&2
RESP="$(curl -fsS -X POST -H "x-admin-token: ${ADMIN_REVIEW_TOKEN}" -H "Content-Type: application/json" "$url")"
ingest_print_orphan_cleanup_summary "$RESP"
