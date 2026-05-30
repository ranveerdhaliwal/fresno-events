#!/usr/bin/env bash
# Deprecated alias — use ingest:preflight-browser.

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
echo "Note: ingest:preflight-crawl → use pnpm ingest:preflight-browser" >&2
exec bash "$REPO_ROOT/scripts/ingest-preflight-browser.sh" "$@"
