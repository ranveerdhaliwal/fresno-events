#!/usr/bin/env bash
# Real promote for all enabled venues (direct + browser lanes).

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
exec bash "$REPO_ROOT/scripts/ingest-promote.sh" --source=venue-ingest "$@"
