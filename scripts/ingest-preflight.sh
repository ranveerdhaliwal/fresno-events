#!/usr/bin/env bash
# Dry-run ingest + validation check before a real promote.
#
# Prerequisite: pnpm ingest:dev in another terminal.
#
# Examples:
#   pnpm ingest:preflight --venue=strummers
#   pnpm ingest:preflight --venue=tower-theatre,save-mart
#   pnpm ingest:preflight --source=venue-ingest          # all enabled venues
#   pnpm ingest:preflight-direct
#   pnpm ingest:preflight-browser
#   pnpm ingest:preflight-all
#   pnpm ingest:preflight --all

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PORT="${INGEST_PORT:-8788}"
SOURCE=""
VENUE=""

while [[ $# -gt 0 ]]; do
  case "$1" in
    --source=*) SOURCE="${1#*=}" ;;
    --source) shift; SOURCE="${1:-}" ;;
    --all) SOURCE="all" ;;
    --port=*) PORT="${1#*=}" ;;
    --venue=*) VENUE="${1#*=}" ;;
    --venue) shift; VENUE="${1:-}" ;;
    -h|--help)
      echo "Usage: pnpm ingest:preflight --venue=<key>[,<key>...] | --source=<key> | --all" >&2
      echo "  --venue alone implies --source=venue-ingest (API vs crawl is per venue config)." >&2
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
ingest_apply_venue_source_defaults || exit $?

if [[ -z "$SOURCE" ]]; then
  echo "One of --venue=<key>, --source=<key>, or --all is required." >&2
  echo "  e.g. pnpm ingest:preflight --venue=strummers" >&2
  exit 2
fi

ingest_load_admin_token

HEALTH_URL="http://127.0.0.1:${PORT}/health"
ingest_log "GET $HEALTH_URL"
HEALTH="$(ingest_curl_json GET "$HEALTH_URL")"

if command -v jq >/dev/null 2>&1; then
  if ! echo "$HEALTH" | jq -e '.ok == true' >/dev/null; then
    echo "Health check failed" >&2
    exit 1
  fi
fi

if [[ "$SOURCE" == "all" ]]; then
  TRIGGER_URL="http://127.0.0.1:${PORT}/trigger?source=all&force=true&dry_run=true"
  ingest_log "POST $TRIGGER_URL"
  RESP="$(ingest_curl_json POST "$TRIGGER_URL")"
  ingest_check_summaries_json "$RESP"
  exit $?
fi

IFS=',' read -r -a SOURCES <<< "$SOURCE"
FAILED=0

for KEY in "${SOURCES[@]}"; do
  KEY="$(echo "$KEY" | xargs)"
  [[ -z "$KEY" ]] && continue

  if command -v jq >/dev/null 2>&1; then
    RUNNABLE="$(echo "$HEALTH" | jq -r --arg k "$KEY" '.data.registered_sources[] | select(.key == $k) | .runnable' | head -1)"
    if [[ "$RUNNABLE" != "true" ]]; then
      echo "FAIL $KEY: not runnable (check .dev.vars secrets)" >&2
      FAILED=1
      continue
    fi
  fi

  VENUE_QUERY=""
  if [[ -n "$VENUE" ]]; then
    VENUE_QUERY="&venue=${VENUE}"
  fi
  TRIGGER_URL="http://127.0.0.1:${PORT}/trigger?source=${KEY}&force=true&dry_run=true${VENUE_QUERY}"
  ingest_log "POST $TRIGGER_URL"
  RESP="$(ingest_curl_json POST "$TRIGGER_URL")"

  if ! ingest_check_summaries_json "$RESP"; then
    FAILED=1
  fi
done

exit "$FAILED"
