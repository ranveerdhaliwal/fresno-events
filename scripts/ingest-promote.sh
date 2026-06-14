#!/usr/bin/env bash
# Real ingest only (writes to DB). Run preflight separately when you want a dry-run check.
#
# Examples:
#   pnpm ingest:promote --source=ticketmaster
#   pnpm ingest:promote --source=strummers
#   pnpm ingest:promote --source=api:visitfresnocounty
#   pnpm ingest:promote-all

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SOURCE=""
NO_ENRICH="false"
EXTRA_RUN_ARGS=()

while [[ $# -gt 0 ]]; do
  case "$1" in
    --source=*) SOURCE="${1#*=}" ;;
    --source) shift; SOURCE="${1:-}" ;;
    --venue=*|--venue)
      echo "Use --source=<key> instead of --venue= (e.g. --source=strummers)." >&2
      exit 2
      ;;
    --all)
      SOURCE="all"
      ;;
    --no-enrich) NO_ENRICH="true" ;;
    --skip-preflight) echo "Note: --skip-preflight is unused; promote no longer runs preflight." >&2 ;;
    -h|--help)
      echo "Usage: pnpm ingest:promote --source=<name> [--no-enrich]" >&2
      echo "  All sources: pnpm ingest:promote-all" >&2
      echo "  List names:  pnpm ingest:sources" >&2
      exit 0
      ;;
    *)
      EXTRA_RUN_ARGS+=("$1")
      ;;
  esac
  shift || true
done

# shellcheck source=scripts/ingest-lib.sh
source "$REPO_ROOT/scripts/ingest-lib.sh"

if [[ -z "$SOURCE" ]]; then
  echo "--source=<name> is required. All sources: pnpm ingest:promote-all (list: pnpm ingest:sources)" >&2
  exit 2
fi

ingest_resolve_user_source "$SOURCE" false || exit $?

PROMOTE_ARGS=(--source="$INGEST_SCRAPER" --force)
if [[ -n "$INGEST_VENUE_FILTER" ]]; then
  PROMOTE_ARGS+=(--venue-filter="$INGEST_VENUE_FILTER")
fi
if [[ "$NO_ENRICH" == "true" ]]; then
  PROMOTE_ARGS+=(--no-enrich)
fi
PROMOTE_ARGS+=("${EXTRA_RUN_ARGS[@]}")

echo "[ingest] Promote source: $INGEST_DISPLAY_SOURCE" >&2

bash "$REPO_ROOT/scripts/ingest-run.sh" "${PROMOTE_ARGS[@]}"
