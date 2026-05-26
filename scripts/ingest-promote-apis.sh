#!/usr/bin/env bash
# Real promote for API venue modules (visit, downtown, milb) via venue-ingest.
#
#   pnpm ingest:preflight-apis    # optional dry-run first
#   pnpm ingest:promote-apis
#   pnpm ingest:promote-apis --no-enrich

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
EXTRA=()

while [[ $# -gt 0 ]]; do
  case "$1" in
    --no-enrich) EXTRA+=(--no-enrich) ;;
    -h|--help)
      echo "Usage: pnpm ingest:promote-apis [--no-enrich]" >&2
      exit 0
      ;;
    *)
      echo "Unknown argument: $1" >&2
      exit 2
      ;;
  esac
  shift || true
done

bash "$REPO_ROOT/scripts/ingest-promote.sh" \
  --source=venue-ingest \
  --venue=visit-fresno-county,downtown-fresno,milb-grizzlies \
  "${EXTRA[@]}"
