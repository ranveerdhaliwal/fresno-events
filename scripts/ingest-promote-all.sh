#!/usr/bin/env bash
# Full collection, details, AI enrichment and review checks. Never bulk approves.
set -euo pipefail
REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
case "${1:-}" in
  --venues-only) shift; exec bash "$REPO_ROOT/scripts/ingest-promote-venues.sh" "$@" ;;
  # Retain the historical collection-only flag for existing callers.
  --no-enrich) exec bash "$REPO_ROOT/scripts/ingest-promote-venues.sh" "$@" ;;
  -h|--help)
    echo "Usage: pnpm ingest:promote-all [--venues-only <venue collection flags>]"
    echo "Default: Ticketmaster + VenuNite + venues, details, AI, address cleanup, duplicate/series/coordinate audit."
    echo "Relinking and orphan deletion are previewed; approvals require a reviewed explicit batch."
    exit 0 ;;
  "") exec bash "$REPO_ROOT/scripts/ingest-scheduled-local.sh" ;;
  *) echo "Collection flags require --venues-only; use --help for the full workflow." >&2; exit 2 ;;
esac
