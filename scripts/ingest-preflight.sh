#!/usr/bin/env bash
# Dry-run ingest + validation check before a real promote.
#
# Prerequisite: pnpm ingest:dev in another terminal.
#
# Examples:
#   pnpm ingest:preflight --source=visit-fresno-api
#   pnpm ingest:preflight --source=visit-fresno-api,milb-api
#   pnpm ingest:preflight --all

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PORT="${INGEST_PORT:-8788}"
SOURCE=""

while [[ $# -gt 0 ]]; do
  case "$1" in
    --source=*) SOURCE="${1#*=}" ;;
    --source) shift; SOURCE="${1:-}" ;;
    --all) SOURCE="all" ;;
    --port=*) PORT="${1#*=}" ;;
    -h|--help)
      echo "Usage: pnpm ingest:preflight --source=<key>[,<key>...] | --all" >&2
      exit 0
      ;;
    *)
      echo "Unknown argument: $1" >&2
      exit 2
      ;;
  esac
  shift || true
done

if [[ -z "$SOURCE" ]]; then
  echo "--source=<key> or --all is required" >&2
  exit 2
fi

# shellcheck source=scripts/ingest-lib.sh
source "$REPO_ROOT/scripts/ingest-lib.sh"
ingest_load_admin_token

HEALTH_URL="http://127.0.0.1:${PORT}/health"
echo "GET $HEALTH_URL" >&2
HEALTH="$(ingest_curl_json GET "$HEALTH_URL")"

if command -v jq >/dev/null 2>&1; then
  if ! echo "$HEALTH" | jq -e '.ok == true' >/dev/null; then
    echo "Health check failed" >&2
    exit 1
  fi
fi

if [[ "$SOURCE" == "all" ]]; then
  TRIGGER_URL="http://127.0.0.1:${PORT}/trigger?source=all&force=true&dry_run=true"
  echo "POST $TRIGGER_URL" >&2
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

  TRIGGER_URL="http://127.0.0.1:${PORT}/trigger?source=${KEY}&force=true&dry_run=true"
  echo "POST $TRIGGER_URL" >&2
  RESP="$(ingest_curl_json POST "$TRIGGER_URL")"

  if ! ingest_check_summaries_json "$RESP"; then
    FAILED=1
  fi
done

exit "$FAILED"
