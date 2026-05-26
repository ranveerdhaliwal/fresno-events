#!/usr/bin/env bash
# Dry-run API venue modules (visit, downtown, milb) via venue-ingest.

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
exec bash "$REPO_ROOT/scripts/ingest-preflight.sh" \
  --source=venue-ingest \
  --venue=visit-fresno-county,downtown-fresno,milb-grizzlies
