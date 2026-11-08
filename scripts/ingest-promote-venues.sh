#!/usr/bin/env bash
# Real promote for all enabled venue sources.

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"

# shellcheck source=scripts/ingest-lib.sh
source "$REPO_ROOT/scripts/ingest-lib.sh"
ingest_resolve_user_source "" true || exit $?

ARGS=(--source="$INGEST_SCRAPER" --force "$@")

echo "[ingest] Promote all venues" >&2
exec bash "$REPO_ROOT/scripts/ingest-run.sh" "${ARGS[@]}"
