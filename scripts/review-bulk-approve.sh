#!/usr/bin/env bash
# Approve all pending_review candidates via one bulk-approve-all API call.
#
# Usage:
#   pnpm review:bulk-approve
#   pnpm review:bulk-approve --dry-run
#   pnpm review:bulk-approve --limit=50
#
# Prerequisite: pnpm dev:api (local review API)

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
# shellcheck source=scripts/dev-ports.env
source "$REPO_ROOT/scripts/dev-ports.env"

DRY_RUN="false"
LIMIT=""
API_ORIGIN="http://127.0.0.1:${FRESNO_API_PORT:-8790}"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --dry-run) DRY_RUN="true" ;;
    --limit=*) LIMIT="${1#*=}" ;;
    --limit) shift; LIMIT="${1:-}" ;;
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

if [[ -z "${ADMIN_REVIEW_TOKEN:-}" ]]; then
  DEV_VARS="$REPO_ROOT/workers/ingest/.dev.vars"
  if [[ -f "$DEV_VARS" ]]; then
    LINE="$(grep -E '^ADMIN_REVIEW_TOKEN=' "$DEV_VARS" | head -1 || true)"
    if [[ -n "$LINE" ]]; then
      ADMIN_REVIEW_TOKEN="${LINE#ADMIN_REVIEW_TOKEN=}"
      ADMIN_REVIEW_TOKEN="${ADMIN_REVIEW_TOKEN%\"}"
      ADMIN_REVIEW_TOKEN="${ADMIN_REVIEW_TOKEN#\"}"
      export ADMIN_REVIEW_TOKEN
    fi
  fi
fi

if [[ -z "${ADMIN_REVIEW_TOKEN:-}" ]]; then
  echo "ADMIN_REVIEW_TOKEN not set. Export it or set workers/ingest/.dev.vars" >&2
  exit 1
fi

if [[ "$DRY_RUN" == "true" ]]; then
  if docker exec supabase_db_what-up-fresno pg_isready -U postgres -d postgres >/dev/null 2>&1; then
    COUNT="$(docker exec supabase_db_what-up-fresno psql -U postgres -d postgres -t -A -c \
      "SELECT count(*)::int FROM event_candidates WHERE status = 'pending_review';")"
    echo "Dry run: ${COUNT} pending_review candidate(s) would be approved."
  else
    echo "Dry run: local Postgres not running (pnpm db:start). Cannot count pending rows." >&2
    exit 1
  fi
  exit 0
fi

HEALTH_URL="${API_ORIGIN}/health"
if ! curl -sf "$HEALTH_URL" >/dev/null; then
  echo "Review API not reachable at ${API_ORIGIN}. Start: pnpm dev:api" >&2
  exit 1
fi

BODY='{"reviewedBy":"review-bulk-approve-script","status":"pending_review"}'
if [[ -n "$LIMIT" ]]; then
  BODY="$(printf '{"reviewedBy":"review-bulk-approve-script","status":"pending_review","limit":%s}' "$LIMIT")"
fi

echo "POST ${API_ORIGIN}/review/candidates/bulk-approve-all …" >&2
RESPONSE="$(curl -sS -w "\n%{http_code}" -X POST "${API_ORIGIN}/review/candidates/bulk-approve-all" \
  -H "Authorization: Bearer ${ADMIN_REVIEW_TOKEN}" \
  -H "Content-Type: application/json" \
  -d "$BODY")"

HTTP_CODE="$(echo "$RESPONSE" | tail -n1)"
JSON_BODY="$(echo "$RESPONSE" | sed '$d')"

if [[ "$HTTP_CODE" != "200" ]]; then
  echo "bulk-approve-all failed (HTTP ${HTTP_CODE}):" >&2
  echo "$JSON_BODY" >&2
  exit 1
fi

echo "$JSON_BODY" | node -e "
const fs = require('fs');
const raw = fs.readFileSync(0, 'utf8');
let payload;
try { payload = JSON.parse(raw); } catch { console.error(raw); process.exit(1); }
if (!payload.ok) {
  console.error(payload.error?.message ?? 'Request failed');
  process.exit(1);
}
const d = payload.data;
console.log('Approved:', d.approved);
console.log('Skipped:', d.skipped?.length ?? 0);
console.log('Failed:', d.failed?.length ?? 0);
if (d.failed?.length) {
  for (const f of d.failed) console.log('  -', f.id, f.message);
  console.log('');
  console.log('Re-run: pnpm review:bulk-approve');
  process.exit(1);
}
"

echo "Done." >&2
