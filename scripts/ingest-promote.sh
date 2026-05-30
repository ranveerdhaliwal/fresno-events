#!/usr/bin/env bash
# Real ingest only (writes to DB). Run preflight separately when you want a dry-run check.
#
# Examples:
#   pnpm ingest:promote --venue=strummers
#   pnpm ingest:promote --venue=downtown-fresno --no-enrich
#   pnpm ingest:promote-direct
#   pnpm ingest:promote-browser
#   pnpm ingest:promote-all

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SOURCE=""
VENUE=""
NO_ENRICH="false"
EXTRA_RUN_ARGS=()

while [[ $# -gt 0 ]]; do
  case "$1" in
    --source=*) SOURCE="${1#*=}" ;;
    --source) shift; SOURCE="${1:-}" ;;
    --venue=*) VENUE="${1#*=}" ;;
    --venue) shift; VENUE="${1:-}" ;;
    --all) SOURCE="all" ;;
    --no-enrich) NO_ENRICH="true" ;;
    --skip-preflight) echo "Note: --skip-preflight is unused; promote no longer runs preflight." >&2 ;;
    -h|--help)
      echo "Usage: pnpm ingest:promote --venue=<key>[,<key>...] | --source=<key> | --all [--no-enrich]" >&2
      echo "  --venue alone implies --source=venue-ingest." >&2
      echo "Dry-run first: pnpm ingest:preflight --venue=..." >&2
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
ingest_apply_venue_source_defaults || exit $?

if [[ -z "$SOURCE" ]]; then
  echo "One of --venue=<key>, --source=<key>, or --all is required." >&2
  echo "  e.g. pnpm ingest:promote --venue=strummers" >&2
  exit 2
fi

PROMOTE_ARGS=(--source="$SOURCE" --force)
if [[ -n "$VENUE" ]]; then
  PROMOTE_ARGS+=(--venue="$VENUE")
fi
if [[ "$NO_ENRICH" == "true" ]]; then
  PROMOTE_ARGS+=(--no-enrich)
fi
PROMOTE_ARGS+=("${EXTRA_RUN_ARGS[@]}")

bash "$REPO_ROOT/scripts/ingest-run.sh" "${PROMOTE_ARGS[@]}"
