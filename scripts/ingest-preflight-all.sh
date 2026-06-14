#!/usr/bin/env bash
# Dry-run all enabled venue sources.

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
exec bash "$REPO_ROOT/scripts/ingest-preflight.sh" --@all-venues "$@"
