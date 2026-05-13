#!/usr/bin/env bash
# Fire a manual ingest run against the local ingest worker.
#
# Usage:
#   pnpm ingest:run --source=ticketmaster
#   pnpm ingest:run --source=ai-discovery --force
#   pnpm ingest:run                         # all enabled sources, respecting cadence
#   pnpm ingest:run --force                 # all enabled sources, ignore cadence
#   pnpm ingest:run --port=8788 --source=eventbrite
#
# Requires the ingest worker to already be running (`pnpm ingest:dev`).
# Reads ADMIN_REVIEW_TOKEN from shell env, falling back to workers/ingest/.dev.vars.

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PORT="${INGEST_PORT:-8788}"
SOURCE=""
FORCE="false"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --source=*) SOURCE="${1#*=}" ;;
    --source) shift; SOURCE="${1:-}" ;;
    --force) FORCE="true" ;;
    --port=*) PORT="${1#*=}" ;;
    --port) shift; PORT="${1:-8788}" ;;
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

QUERY="force=$FORCE"
if [[ -n "$SOURCE" ]]; then
  QUERY="source=$SOURCE&$QUERY"
fi
URL="http://127.0.0.1:${PORT}/trigger?${QUERY}"

echo "POST $URL" >&2
RESP="$(curl -fsS -X POST -H "x-admin-token: ${ADMIN_REVIEW_TOKEN}" "$URL")"

if command -v jq >/dev/null 2>&1; then
  echo "$RESP" | jq .
else
  echo "$RESP"
fi
