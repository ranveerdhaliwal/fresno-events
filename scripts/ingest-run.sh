#!/usr/bin/env bash
# Run data ingestion against the local ingest worker (fetch → dev DB).
#
# Prerequisite: pnpm ingest:dev in another terminal.
#
# Examples:
#   pnpm ingest:run --source=ticketmaster --force
#   pnpm ingest:run --source=ai-discovery --dry-run
#   pnpm ingest:run --source=ticketmaster,ai-discovery --force
#   pnpm ingest:run --all --force
#   pnpm ingest:run                    # cron-style: default sources that are due

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PORT="${INGEST_PORT:-8788}"
SOURCE=""
FORCE="false"
DRY_RUN="false"
RESUME_JOBS="false"
NO_ENRICH="false"

usage() {
  sed -n '2,14p' "$0" | sed 's/^# \{0,1\}//'
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
    --resume-jobs) RESUME_JOBS="true" ;;
    --no-enrich) NO_ENRICH="true" ;;
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

if [[ "$DRY_RUN" == "true" && "$RESUME_JOBS" == "true" ]]; then
  echo "Cannot combine --dry-run and --resume-jobs." >&2
  exit 2
fi

QUERY="force=$FORCE&dry_run=$DRY_RUN&resume_jobs=$RESUME_JOBS"
if [[ "$NO_ENRICH" == "true" ]]; then
  QUERY="${QUERY}&no_enrich=true"
fi
if [[ -n "$SOURCE" ]]; then
  QUERY="source=${SOURCE}&$QUERY"
fi
URL="http://127.0.0.1:${PORT}/trigger?${QUERY}"

echo "POST $URL" >&2
RESP="$(curl -fsS -X POST -H "x-admin-token: ${ADMIN_REVIEW_TOKEN}" "$URL")"

if command -v jq >/dev/null 2>&1; then
  echo "$RESP" | jq .
else
  echo "$RESP"
fi
