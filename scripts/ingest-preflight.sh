#!/usr/bin/env bash
# Dry-run ingest + validation check before a real promote.
#
# Prerequisite: pnpm ingest:dev in another terminal.
#
# Examples:
#   pnpm ingest:preflight --source=strummers
#   pnpm ingest:preflight --source=ticketmaster
#   pnpm ingest:preflight-all

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PORT="${INGEST_PORT:-8788}"
SOURCE=""
ALL_VENUES="false"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --source=*) SOURCE="${1#*=}" ;;
    --source) shift; SOURCE="${1:-}" ;;
    --all) SOURCE="all" ;;
    --@all-venues) ALL_VENUES="true" ;;
    --port=*) PORT="${1#*=}" ;;
    --venue=*|--venue)
      echo "Use --source=<key> instead of --venue= (e.g. --source=strummers)." >&2
      exit 2
      ;;
    -h|--help)
      echo "Usage: pnpm ingest:preflight --source=<key>" >&2
      echo "  All venues: pnpm ingest:preflight-all" >&2
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

if [[ "$ALL_VENUES" != "true" && -z "$SOURCE" ]]; then
  echo "--source=<key> is required. For all venues use: pnpm ingest:preflight-all" >&2
  exit 2
fi

ingest_load_admin_token

if [[ "$ALL_VENUES" == "true" ]]; then
  ingest_resolve_user_source "" true || exit $?
else
  ingest_resolve_user_source "$SOURCE" false || exit $?
fi

HEALTH_URL="http://127.0.0.1:${PORT}/health"
ingest_log "GET $HEALTH_URL"
HEALTH="$(ingest_curl_json GET "$HEALTH_URL")"

if command -v jq >/dev/null 2>&1; then
  if ! echo "$HEALTH" | jq -e '.ok == true' >/dev/null; then
    echo "Health check failed" >&2
    exit 1
  fi
fi

if [[ "$INGEST_SCRAPER" == "all" ]]; then
  TRIGGER_URL="http://127.0.0.1:${PORT}/trigger?source=all&force=true&dry_run=true"
  ingest_log "POST $TRIGGER_URL"
  RESP="$(ingest_curl_json POST "$TRIGGER_URL")"
  ingest_check_summaries_json "$RESP"
  exit $?
fi

if command -v jq >/dev/null 2>&1; then
  IFS=',' read -r -a SCRAPER_KEYS <<< "$INGEST_SCRAPER"
  for KEY in "${SCRAPER_KEYS[@]}"; do
    KEY="$(echo "$KEY" | xargs)"
    [[ -z "$KEY" ]] && continue
    RUNNABLE="$(echo "$HEALTH" | jq -r --arg k "$KEY" '.data.registered_sources[] | select(.key == $k) | .runnable' | head -1)"
    if [[ "$RUNNABLE" != "true" ]]; then
      echo "FAIL $KEY: not runnable (check .dev.vars secrets)" >&2
      exit 1
    fi
  done
fi

VENUE_QUERY=""
if [[ -n "$INGEST_VENUE_FILTER" ]]; then
  VENUE_QUERY="&venue=${INGEST_VENUE_FILTER}"
fi

echo "[ingest] Preflight source: $INGEST_DISPLAY_SOURCE" >&2
TRIGGER_URL="http://127.0.0.1:${PORT}/trigger?source=${INGEST_SCRAPER}&force=true&dry_run=true${VENUE_QUERY}"
ingest_log "POST $TRIGGER_URL"
RESP="$(ingest_curl_json POST "$TRIGGER_URL")"
ingest_check_summaries_json "$RESP"
