#!/usr/bin/env bash
# Deprecated: ai-crawl + seed_urls removed. Use venue-ingest.

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
EXTRA=()

while [[ $# -gt 0 ]]; do
  case "$1" in
    --no-enrich) EXTRA+=(--no-enrich) ;;
    *)
      EXTRA+=("$1")
      ;;
  esac
  shift || true
done

echo "ingest:promote-crawl is deprecated — use pnpm ingest:promote-venues" >&2
exec bash "$REPO_ROOT/scripts/ingest-promote-venues.sh" "${EXTRA[@]}"
