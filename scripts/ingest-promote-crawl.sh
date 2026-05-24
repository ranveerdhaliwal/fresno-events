#!/usr/bin/env bash
# Real promote for ai-crawl (Browser Rendering venue seeds).
#
#   pnpm ingest:preflight-crawl   # optional — plans targets, no BR jobs
#   pnpm ingest:promote-crawl
#
# Docs: https://developers.cloudflare.com/browser-run/quick-actions/crawl-endpoint/
# Cancel in-flight job: DELETE .../browser-rendering/crawl/{job_id}

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
EXTRA=()

while [[ $# -gt 0 ]]; do
  case "$1" in
    --no-enrich) EXTRA+=(--no-enrich) ;;
    -h|--help)
      echo "Usage: pnpm ingest:promote-crawl [--no-enrich]" >&2
      exit 0
      ;;
    *)
      echo "Unknown argument: $1" >&2
      exit 2
      ;;
  esac
  shift || true
done

bash "$REPO_ROOT/scripts/ingest-promote.sh" --source=ai-crawl "${EXTRA[@]}"
