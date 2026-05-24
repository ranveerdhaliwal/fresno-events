#!/usr/bin/env bash
# Trigger post-ingest AI enrichment (or dry-run preview).
#
# Examples:
#   pnpm ingest:enrich --dry-run --limit=5
#   pnpm ingest:enrich --source=api:visitfresnocounty --limit=50
#   pnpm ingest:enrich --all          # all pending, not yet AI-tagged (batches of 100)
#   pnpm ingest:enrich --all --limit=30

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PORT="${INGEST_PORT:-8788}"
DRY_RUN="false"
SOURCE=""
LIMIT=""
ENRICH_ALL="false"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --dry-run) DRY_RUN="true" ;;
    --source=*) SOURCE="${1#*=}" ;;
    --source) shift; SOURCE="${1:-}" ;;
    --limit=*) LIMIT="${1#*=}" ;;
    --limit) shift; LIMIT="${1:-}" ;;
    --all) ENRICH_ALL="true" ;;
    --port=*) PORT="${1#*=}" ;;
    -h|--help)
      echo "Usage: pnpm ingest:enrich [--dry-run] [--source=api:...] [--limit=N] [--all]" >&2
      echo "  --all   Process every pending row without [ai] review_notes, in batches (max 100 per request)." >&2
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

ingest_enrich_once() {
  local batch_limit="$1"
  local query="limit=${batch_limit}"
  if [[ "$DRY_RUN" == "true" ]]; then
    query="${query}&dry_run=true"
  fi
  if [[ -n "$SOURCE" ]]; then
    query="${query}&source=${SOURCE}"
  fi

  local url="http://127.0.0.1:${PORT}/enrichment/trigger?${query}"
  echo "POST $url" >&2
  ingest_curl_json POST "$url"
}

if [[ "$ENRICH_ALL" != "true" ]]; then
  BATCH_LIMIT="${LIMIT:-25}"
  RESP="$(ingest_enrich_once "$BATCH_LIMIT")"
  if command -v jq >/dev/null 2>&1; then
    echo "$RESP" | jq .
  else
    echo "$RESP"
  fi
  exit 0
fi

# --all: repeat until no rows left (only enriches pending_review with review_notes IS NULL)
BATCH_LIMIT="${LIMIT:-100}"
if [[ "$BATCH_LIMIT" -gt 100 ]]; then
  BATCH_LIMIT=100
fi
if [[ "$BATCH_LIMIT" -lt 1 ]]; then
  BATCH_LIMIT=1
fi

ROUND=0
TOTAL_PROCESSED=0
TOTAL_UPDATED=0

while true; do
  ROUND=$((ROUND + 1))
  RESP="$(ingest_enrich_once "$BATCH_LIMIT")"

  if ! command -v jq >/dev/null 2>&1; then
    echo "$RESP"
    echo "Install jq to use --all batching." >&2
    exit 0
  fi

  PROCESSED="$(echo "$RESP" | jq -r '.data.summary.processed // 0')"
  UPDATED="$(echo "$RESP" | jq -r '.data.summary.updated // 0')"
  SKIPPED="$(echo "$RESP" | jq -r '.data.summary.skipped_no_backend // false')"

  echo "$RESP" | jq --arg round "$ROUND" '{round: ($round | tonumber), summary: .data.summary}'

  if [[ "$SKIPPED" == "true" ]]; then
    exit 1
  fi

  TOTAL_PROCESSED=$((TOTAL_PROCESSED + PROCESSED))
  TOTAL_UPDATED=$((TOTAL_UPDATED + UPDATED))

  if [[ "$PROCESSED" -eq 0 ]]; then
    break
  fi

  if [[ "$DRY_RUN" == "true" ]]; then
    break
  fi
done

echo "Enrich --all finished: rounds=$ROUND processed=$TOTAL_PROCESSED updated=$TOTAL_UPDATED" >&2
