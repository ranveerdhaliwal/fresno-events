#!/usr/bin/env bash
# Export dev port env vars, then run the given command.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
# shellcheck source=scripts/dev-ports.env
source "$ROOT/scripts/dev-ports.env"

export FRESNO_WEB_ORIGIN="http://localhost:${FRESNO_WEB_PORT}"
export FRESNO_API_ORIGIN="http://127.0.0.1:${FRESNO_API_PORT}"
export VITE_APP_URL="${FRESNO_WEB_ORIGIN}"
export VITE_API_URL="${FRESNO_API_ORIGIN}"

exec "$@"
