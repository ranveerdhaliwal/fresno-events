#!/usr/bin/env bash
# Real ingest only (writes to DB). Run preflight separately when you want a dry-run check.
#
# Examples:
#   pnpm ingest:promote --source=visit-fresno-api
#   pnpm ingest:promote-apis          # wrapper for API sources
#   pnpm ingest:promote-crawl         # ai-crawl only
#   pnpm ingest:promote --source=visit-fresno-api --no-enrich

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SOURCE=""
NO_ENRICH="false"
EXTRA_RUN_ARGS=()

while [[ $# -gt 0 ]]; do
  case "$1" in
    --source=*) SOURCE="${1#*=}" ;;
    --source) shift; SOURCE="${1:-}" ;;
    --all) SOURCE="all" ;;
    --no-enrich) NO_ENRICH="true" ;;
    --skip-preflight) echo "Note: --skip-preflight is unused; promote no longer runs preflight." >&2 ;;
    -h|--help)
      echo "Usage: pnpm ingest:promote --source=<key>[,<key>...] | --all [--no-enrich]" >&2
      echo "Dry-run first: pnpm ingest:preflight --source=... or pnpm ingest:preflight-apis" >&2
      exit 0
      ;;
    *)
      EXTRA_RUN_ARGS+=("$1")
      ;;
  esac
  shift || true
done

if [[ -z "$SOURCE" ]]; then
  echo "--source=<key> or --all is required" >&2
  exit 2
fi

PROMOTE_ARGS=(--source="$SOURCE" --force)
if [[ "$NO_ENRICH" == "true" ]]; then
  PROMOTE_ARGS+=(--no-enrich)
fi
PROMOTE_ARGS+=("${EXTRA_RUN_ARGS[@]}")

bash "$REPO_ROOT/scripts/ingest-run.sh" "${PROMOTE_ARGS[@]}"
