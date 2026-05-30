#!/usr/bin/env bash
# Real promote for direct venues (API + html_parse).

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
VENUES="$(node "$REPO_ROOT/scripts/ingest-venue-lane-keys.mjs" direct)"
exec bash "$REPO_ROOT/scripts/ingest-promote.sh" --venue="$VENUES" "$@"
