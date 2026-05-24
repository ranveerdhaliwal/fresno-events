#!/usr/bin/env bash
# Dry-run ai-crawl: logs crawl plan per seed (limit/depth/URLs) — does NOT start Browser Rendering jobs.

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
exec bash "$REPO_ROOT/scripts/ingest-preflight.sh" --source=ai-crawl
