#!/usr/bin/env bash
# Run the local Vite dev server against a cloud API target (dev or prod).
#
# Usage: bash scripts/dev-web-cloud.sh <dev|prod>
#
# Reads target URL from (in order):
#   1. Shell env: VITE_API_URL_DEV  / VITE_API_URL_PROD
#   2. .env.cloud-targets at repo root (key=value lines)
#
# Example .env.cloud-targets (gitignored):
#   VITE_API_URL_DEV=https://fresno-events-api-dev.<account>.workers.dev
#   VITE_API_URL_PROD=https://api.whatupfresno.com

set -euo pipefail

TARGET="${1:-}"
case "$TARGET" in
  dev|prod) ;;
  *)
    echo "Usage: $0 <dev|prod>" >&2
    exit 2
    ;;
esac

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
ENV_FILE="$REPO_ROOT/.env.cloud-targets"

if [[ -f "$ENV_FILE" ]]; then
  set -a
  # shellcheck source=/dev/null
  source "$ENV_FILE"
  set +a
fi

if [[ "$TARGET" == "dev" ]]; then
  URL="${VITE_API_URL_DEV:-}"
  KEY="VITE_API_URL_DEV"
else
  URL="${VITE_API_URL_PROD:-}"
  KEY="VITE_API_URL_PROD"
fi

if [[ -z "$URL" ]]; then
  cat >&2 <<EOF
$KEY is not set.

Either export it in your shell:
  export $KEY=https://fresno-events-api-$TARGET.<account>.workers.dev

Or create $ENV_FILE with:
  VITE_API_URL_DEV=https://fresno-events-api-dev.<account>.workers.dev
  VITE_API_URL_PROD=https://api.whatupfresno.com
EOF
  exit 1
fi

echo "Pointing local Vite dev server at $TARGET API: $URL"
exec env VITE_API_URL="$URL" pnpm --filter @fresno-events/web dev
