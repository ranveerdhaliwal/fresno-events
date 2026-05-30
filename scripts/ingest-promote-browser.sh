#!/usr/bin/env bash
# Real promote for Browser Rendering crawl venues.

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
VENUES="$(node "$REPO_ROOT/scripts/ingest-venue-lane-keys.mjs" browser)"
exec bash "$REPO_ROOT/scripts/ingest-promote.sh" --venue="$VENUES" "$@"
