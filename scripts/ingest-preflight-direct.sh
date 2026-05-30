#!/usr/bin/env bash
# Dry-run direct venues (API + html_parse — no Browser Rendering on promote).

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
VENUES="$(node "$REPO_ROOT/scripts/ingest-venue-lane-keys.mjs" direct)"
exec bash "$REPO_ROOT/scripts/ingest-preflight.sh" --venue="$VENUES" "$@"
