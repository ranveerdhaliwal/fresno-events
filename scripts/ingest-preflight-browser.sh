#!/usr/bin/env bash
# Dry-run Browser Rendering crawl venues (listing/detail + LLM on promote).

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
VENUES="$(node "$REPO_ROOT/scripts/ingest-venue-lane-keys.mjs" browser)"
exec bash "$REPO_ROOT/scripts/ingest-preflight.sh" --venue="$VENUES" "$@"
