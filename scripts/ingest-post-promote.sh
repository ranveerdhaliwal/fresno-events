#!/usr/bin/env bash
# Post-promote maintenance: detail pages, AI enrichment backlog, ingest exclusions, venue addresses.
#
# Run after promote-all + ticketmaster + venunite (ingest worker must be up).
# Does NOT re-scrape sources. For the full local pipeline including promotes, use:
#   pnpm ingest:scheduled-local
#
# Usage:
#   pnpm ingest:post-promote
#   pnpm ingest:post-promote --dry-run   # detail-backfill + enrich dry-run only

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
DRY_RUN="false"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --dry-run) DRY_RUN="true" ;;
    -h|--help)
      sed -n '2,12p' "$0" | sed 's/^# \{0,1\}//'
      exit 0
      ;;
    *)
      echo "Unknown argument: $1" >&2
      exit 2
      ;;
  esac
  shift || true
done

PORT="${INGEST_PORT:-8788}"
if ! curl -fsS "http://127.0.0.1:${PORT}/health" >/dev/null 2>&1; then
  echo "Ingest worker not reachable on :${PORT}. Start: pnpm ingest:dev" >&2
  exit 1
fi

run_step() {
  echo ""
  echo ">>> $*"
  "$@"
}

DETAIL_ARGS=(--all)
ENRICH_ARGS=(--all)
ADDRESS_ARGS=()
if [[ "$DRY_RUN" == "true" ]]; then
  DETAIL_ARGS+=(--dry-run)
  ENRICH_ARGS+=(--dry-run)
  ADDRESS_ARGS+=(--dry-run)
fi

run_step bash "$REPO_ROOT/scripts/ingest-detail-backfill.sh" "${DETAIL_ARGS[@]}"
run_step bash "$REPO_ROOT/scripts/ingest-enrich.sh" "${ENRICH_ARGS[@]}"
if [[ "$DRY_RUN" != "true" ]]; then
  run_step bash "$REPO_ROOT/scripts/review-reject-exclusions.sh" --apply
else
  run_step bash "$REPO_ROOT/scripts/review-reject-exclusions.sh" --dry-run
fi
run_step bash "$REPO_ROOT/scripts/backfill-venue-addresses.sh" "${ADDRESS_ARGS[@]}"

echo ""
echo "Post-promote complete (detail-backfill, enrich, reject-exclusions, venue-address backfill)."
