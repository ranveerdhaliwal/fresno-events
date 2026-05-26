#!/usr/bin/env bash
# Dry-run venue-ingest — writes venue_ingest_runs dry_run rows, no event_candidates.

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
exec bash "$REPO_ROOT/scripts/ingest-preflight.sh" --source=venue-ingest "$@"
