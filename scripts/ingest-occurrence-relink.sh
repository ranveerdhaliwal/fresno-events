#!/usr/bin/env bash
# Recompute occurrence_key / occurrence_id and cross-source duplicate links for all candidates.
#
# Use after changing matching rules in packages/shared/src/occurrence.ts.
# Re-promote alone is not enough — existing rows keep stale keys and skip cross-source lookup.
#
# Examples:
#   pnpm ingest:relink --dry-run
#   pnpm ingest:relink
#   pnpm ingest:relink --source=ticketmaster
#   INGEST_VERBOSE=1 pnpm ingest:relink   # append full JSON

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PORT="${INGEST_PORT:-8788}"
DRY_RUN="false"
SOURCE=""
LIMIT=""

while [[ $# -gt 0 ]]; do
  case "$1" in
    --dry-run) DRY_RUN="true" ;;
    --source=*) SOURCE="${1#*=}" ;;
    --source) shift; SOURCE="${1:-}" ;;
    --limit=*) LIMIT="${1#*=}" ;;
    --limit) shift; LIMIT="${1:-}" ;;
    --port=*) PORT="${1#*=}" ;;
    -h|--help)
      echo "Usage: pnpm ingest:relink [--dry-run] [--source=<source>] [--limit=N]" >&2
      echo "  Requires ingest worker on port ${PORT} (pnpm ingest:dev)." >&2
      echo "  Recomputes occurrence keys and duplicate links across all candidates." >&2
      echo "  Set INGEST_VERBOSE=1 to print the raw JSON response." >&2
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

query=""
if [[ "$DRY_RUN" == "true" ]]; then
  query="dry_run=true"
fi
if [[ -n "$SOURCE" ]]; then
  query="${query:+$query&}source=${SOURCE}"
fi
if [[ -n "$LIMIT" ]]; then
  query="${query:+$query&}limit=${LIMIT}"
fi

url="http://127.0.0.1:${PORT}/occurrence-relink/trigger"
if [[ -n "$query" ]]; then
  url="${url}?${query}"
fi

ingest_log "POST $url"
echo "POST $url" >&2
RESP="$(ingest_curl_json POST "$url")"
ingest_print_relink_summary "$RESP"
