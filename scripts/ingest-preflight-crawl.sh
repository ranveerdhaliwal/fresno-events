#!/usr/bin/env bash
# Deprecated: ai-crawl + seed_urls removed. Use venue-ingest.

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
echo "ingest:preflight-crawl is deprecated — use pnpm ingest:preflight-venues" >&2
exec bash "$REPO_ROOT/scripts/ingest-preflight-venues.sh" "$@"
