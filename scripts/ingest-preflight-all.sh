#!/usr/bin/env bash
# Dry-run all enabled venues (direct + browser lanes).

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
exec bash "$REPO_ROOT/scripts/ingest-preflight.sh" --source=venue-ingest "$@"
