#!/usr/bin/env bash
# Dry-run all custom API / special-url ingest sources (visit, downtown, milb, seed-special-url).

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
exec bash "$REPO_ROOT/scripts/ingest-preflight.sh" \
  --source=visit-fresno-api,downtown-fresno-api,milb-api,seed-special-url
