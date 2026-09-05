#!/usr/bin/env bash
# Cancel published events that match shared ingest exclusion rules.
#
# Usage:
#   pnpm published:reject-exclusions            # dry-run
#   pnpm published:reject-exclusions --apply    # write changes

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$REPO_ROOT"

pnpm --filter @fresno-events/shared build
node scripts/published-reject-exclusions.mjs "$@"
