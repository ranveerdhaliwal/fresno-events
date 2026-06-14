#!/usr/bin/env bash
# Run data ingestion against the local ingest worker (fetch → dev DB).
#
# Prerequisite: pnpm ingest:dev in another terminal.
#
# Examples:
#   pnpm ingest:run --source=ticketmaster --force
#   pnpm ingest:run --source=ticketmaster,venunite --force

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PORT="${INGEST_PORT:-8788}"
SOURCE=""
FORCE="false"
DRY_RUN="false"
NO_ENRICH="false"
VENUE_FILTER=""

usage() {
  sed -n '2,9p' "$0" | sed 's/^# \{0,1\}//'
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --source=*) SOURCE="${1#*=}" ;;
    --source) shift; SOURCE="${1:-}" ;;
    --sources=*) SOURCE="${1#*=}" ;;
    --sources) shift; SOURCE="${1:-}" ;;
    --all) SOURCE="all"; FORCE="true" ;;
    --force) FORCE="true" ;;
    --dry-run) DRY_RUN="true" ;;
    --no-enrich) NO_ENRICH="true" ;;
    --venue-filter=*) VENUE_FILTER="${1#*=}" ;;
    --venue-filter) shift; VENUE_FILTER="${1:-}" ;;
    --venue=*|--venue)
      echo "Use --source=<key> via ingest:promote (not --venue= on ingest:run)." >&2
      exit 2
      ;;
    --port=*) PORT="${1#*=}" ;;
    --port) shift; PORT="${1:-8788}" ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      echo "Unknown argument: $1" >&2
      usage >&2
      exit 2
      ;;
  esac
  shift || true
done

if [[ -z "$SOURCE" && "$FORCE" != "true" && "$DRY_RUN" != "true" ]]; then
  echo "Specify --source=<key> --force (use pnpm ingest:promote for the usual flow)." >&2
  exit 2
fi

if [[ -z "${ADMIN_REVIEW_TOKEN:-}" ]]; then
  DEV_VARS="$REPO_ROOT/workers/ingest/.dev.vars"
  if [[ -f "$DEV_VARS" ]]; then
    LINE="$(grep -E '^ADMIN_REVIEW_TOKEN=' "$DEV_VARS" | head -1 || true)"
    if [[ -n "$LINE" ]]; then
      ADMIN_REVIEW_TOKEN="${LINE#ADMIN_REVIEW_TOKEN=}"
      ADMIN_REVIEW_TOKEN="${ADMIN_REVIEW_TOKEN%\"}"
      ADMIN_REVIEW_TOKEN="${ADMIN_REVIEW_TOKEN#\"}"
      export ADMIN_REVIEW_TOKEN
    fi
  fi
fi

if [[ -z "${ADMIN_REVIEW_TOKEN:-}" ]]; then
  echo "ADMIN_REVIEW_TOKEN not set. Export it or set it in workers/ingest/.dev.vars" >&2
  exit 1
fi

QUERY="force=$FORCE&dry_run=$DRY_RUN"
if [[ "$NO_ENRICH" == "true" ]]; then
  QUERY="${QUERY}&no_enrich=true"
fi
if [[ -n "$SOURCE" ]]; then
  QUERY="source=${SOURCE}&$QUERY"
fi
if [[ -n "$VENUE_FILTER" ]]; then
  QUERY="${QUERY}&venue=${VENUE_FILTER}"
fi
URL="http://127.0.0.1:${PORT}/trigger?${QUERY}"

echo "POST $URL" >&2
RESP="$(curl -fsS -X POST -H "x-admin-token: ${ADMIN_REVIEW_TOKEN}" "$URL")"

SUMMARY_SCRIPT="$REPO_ROOT/scripts/ingest-print-preflight-summary.mjs"
if [[ -f "$SUMMARY_SCRIPT" ]] && command -v node >/dev/null 2>&1; then
  printf '%s' "$RESP" | node "$SUMMARY_SCRIPT"
  exit $?
fi

if command -v jq >/dev/null 2>&1; then
  echo "$RESP" | jq .
else
  echo "$RESP"
fi
