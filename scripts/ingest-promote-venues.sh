#!/usr/bin/env bash
# Real venue-ingest promote (preflight separately with ingest:preflight-venues).

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
exec bash "$REPO_ROOT/scripts/ingest-promote.sh" --source=venue-ingest "$@"
