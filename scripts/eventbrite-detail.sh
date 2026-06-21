#!/usr/bin/env bash
# Eventbrite detail-page enrichment (description only). Applies to DB by default.
#
# Examples:
#   pnpm eventbrite:detail --url="https://www.eventbrite.com/e/..."   # parse preview only
#   pnpm eventbrite:detail --url="..." --match-candidate
#   pnpm eventbrite:detail --candidate-id=<uuid>
#   pnpm eventbrite:detail --limit=3
#   pnpm eventbrite:detail --dry-run --limit=5

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$REPO_ROOT/workers/ingest"

pnpm exec tsx scripts/eventbrite-detail-run.ts "$@"
