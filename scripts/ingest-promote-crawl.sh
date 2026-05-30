#!/usr/bin/env bash
# Deprecated alias — use ingest:promote-browser.

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
echo "Note: ingest:promote-crawl → use pnpm ingest:promote-browser" >&2
exec bash "$REPO_ROOT/scripts/ingest-promote-browser.sh" "$@"
