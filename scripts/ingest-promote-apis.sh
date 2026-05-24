#!/usr/bin/env bash
# Real promote for API / special-url sources (no Browser Rendering).
#
#   pnpm ingest:preflight-apis    # optional dry-run first
#   pnpm ingest:promote-apis
#   pnpm ingest:promote-apis --no-enrich

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
APIS="visit-fresno-api,downtown-fresno-api,milb-api,seed-special-url"
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

bash "$REPO_ROOT/scripts/ingest-promote.sh" --source="$APIS" "${EXTRA[@]}"
