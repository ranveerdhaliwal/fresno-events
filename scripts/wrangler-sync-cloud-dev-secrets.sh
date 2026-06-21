#!/usr/bin/env bash
# Push cloud-dev secrets from dev-target.env to Workers (--env dev). Idempotent.
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
# shellcheck source=scripts/dev-target.sh
source "$REPO_ROOT/scripts/dev-target.sh"
dev_target_load_file || exit 1

put_secret() {
  local worker_dir="$1"
  local name="$2"
  local value="$3"
  if [[ -z "$value" ]]; then
    echo "skip $name (empty)" >&2
    return 0
  fi
  echo "put $name → $(basename "$worker_dir")" >&2
  # Ingest dev-target sets CLOUDFLARE_API_TOKEN for Browser Rendering; unset so wrangler uses OAuth login.
  printf '%s' "$value" | (cd "$worker_dir" && env -u CLOUDFLARE_API_TOKEN npx wrangler secret put "$name" --env dev)
}

API_DIR="$REPO_ROOT/apps/api"
INGEST_DIR="$REPO_ROOT/workers/ingest"

put_secret "$API_DIR" SUPABASE_URL "${SUPABASE_URL_CLOUD_DEV:-}"
put_secret "$API_DIR" SUPABASE_SERVICE_ROLE_KEY "${SUPABASE_SERVICE_ROLE_KEY_CLOUD_DEV:-}"
put_secret "$API_DIR" ADMIN_REVIEW_TOKEN "${ADMIN_REVIEW_TOKEN:-}"
put_secret "$API_DIR" GOOGLE_MAPS_PLATFORM_API_KEY "${GOOGLE_MAPS_PLATFORM_API_KEY:-}"

INGEST_URL_VALUE="${INGEST_URL_CLOUD_DEV:-https://fresno-events-ingest-dev.mythlegendx.workers.dev}"
put_secret "$API_DIR" INGEST_URL "$INGEST_URL_VALUE"

put_secret "$INGEST_DIR" SUPABASE_URL "${SUPABASE_URL_CLOUD_DEV:-}"
put_secret "$INGEST_DIR" SUPABASE_SERVICE_ROLE_KEY "${SUPABASE_SERVICE_ROLE_KEY_CLOUD_DEV:-}"
put_secret "$INGEST_DIR" ADMIN_REVIEW_TOKEN "${ADMIN_REVIEW_TOKEN:-}"
put_secret "$INGEST_DIR" TICKETMASTER_API_KEY "${TICKETMASTER_API_KEY:-}"
put_secret "$INGEST_DIR" GEMINI_API_KEY "${GEMINI_API_KEY:-}"
put_secret "$INGEST_DIR" VISIT_FRESNO_API_TOKEN "${VISIT_FRESNO_API_TOKEN:-}"
put_secret "$INGEST_DIR" CLOUDFLARE_ACCOUNT_ID "${CLOUDFLARE_ACCOUNT_ID:-}"
put_secret "$INGEST_DIR" CLOUDFLARE_API_TOKEN "${CLOUDFLARE_API_TOKEN:-}"

echo "Done syncing cloud-dev Worker secrets." >&2
