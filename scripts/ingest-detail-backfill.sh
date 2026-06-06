#!/usr/bin/env bash
# Fetch pending detail pages and merge price/address into event_candidates.
#
# Examples:
#   pnpm ingest:detail-backfill --dry-run --limit=5
#   pnpm ingest:detail-backfill --source=api:visitfresnocounty
#   pnpm ingest:detail-backfill --all --limit=50

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PORT="${INGEST_PORT:-8788}"
DRY_RUN="false"
SOURCE=""
LIMIT=""
BACKFILL_ALL="false"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --dry-run) DRY_RUN="true" ;;
    --source=*) SOURCE="${1#*=}" ;;
    --source) shift; SOURCE="${1:-}" ;;
    --limit=*) LIMIT="${1#*=}" ;;
    --limit) shift; LIMIT="${1:-}" ;;
    --all) BACKFILL_ALL="true" ;;
    --port=*) PORT="${1#*=}" ;;
    -h|--help)
      echo "Usage: pnpm ingest:detail-backfill [--dry-run] [--source=api:...] [--limit=N] [--all]" >&2
      echo "  Run after promote, before ingest:enrich for Visit Fresno (price on detail pages)." >&2
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

ingest_detail_once() {
  local batch_limit="$1"
  local query="limit=${batch_limit}"
  if [[ "$DRY_RUN" == "true" ]]; then
    query="${query}&dry_run=true"
  fi
  if [[ -n "$SOURCE" ]]; then
    query="${query}&source=${SOURCE}"
  fi

  local url="http://127.0.0.1:${PORT}/detail-backfill/trigger?${query}"
  echo "POST $url" >&2
  ingest_curl_json POST "$url"
}

if [[ "$BACKFILL_ALL" != "true" ]]; then
  BATCH_LIMIT="${LIMIT:-50}"
  RESP="$(ingest_detail_once "$BATCH_LIMIT")"
  if command -v jq >/dev/null 2>&1; then
    echo "$RESP" | jq .
  else
    echo "$RESP"
  fi
  exit 0
fi

# Default larger batches for --all (still deduped by URL inside each request).
BATCH_LIMIT="${LIMIT:-200}"
if [[ "$BATCH_LIMIT" -gt 500 ]]; then
  BATCH_LIMIT=500
fi

ROUND=0
TOTAL_UPDATED=0

while true; do
  ROUND=$((ROUND + 1))
  RESP="$(ingest_detail_once "$BATCH_LIMIT")"

  MARKED_COMPLETE="$(ingest_json_summary_field "$RESP" "marked_complete")"
  STILL_PENDING="$(ingest_json_summary_field "$RESP" "still_pending")"
  ERRORS="$(ingest_json_summary_field "$RESP" "errors")"

  if command -v jq >/dev/null 2>&1; then
    echo "$RESP" | jq --arg round "$ROUND" '{round: ($round | tonumber), summary: .data.summary}'
  else
    echo "round=$ROUND marked_complete=$MARKED_COMPLETE still_pending=$STILL_PENDING errors=$ERRORS" >&2
  fi

  TOTAL_UPDATED=$((TOTAL_UPDATED + MARKED_COMPLETE))

  # Stop when nothing transitions to complete (avoids looping on rows that stay pending).
  if [[ "$MARKED_COMPLETE" -eq 0 ]]; then
    break
  fi

  if [[ "$DRY_RUN" == "true" ]]; then
    break
  fi
done

echo "Detail backfill --all finished: rounds=$ROUND marked_complete=$TOTAL_UPDATED errors=$ERRORS" >&2
