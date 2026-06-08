#!/usr/bin/env bash
# Normalize mailing-line venue addresses via ingest worker.
#
# Examples:
#   pnpm db:backfill-addresses --dry-run
#   pnpm db:backfill-addresses
#   pnpm db:backfill-addresses --source=api:visitfresnocounty

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PORT="${INGEST_PORT:-8788}"
DRY_RUN="false"
SOURCE=""

while [[ $# -gt 0 ]]; do
  case "$1" in
    --dry-run) DRY_RUN="true" ;;
    --source=*) SOURCE="${1#*=}" ;;
    --source) shift; SOURCE="${1:-}" ;;
    -h|--help)
      echo "Usage: pnpm db:backfill-addresses [--dry-run] [--source=api:...]" >&2
      echo "  Requires ingest worker on port ${PORT} (pnpm ingest:dev)." >&2
      exit 0
      ;;
    *)
      echo "Unknown argument: $1" >&2
      exit 2
      ;;
  esac
  shift || true
done

# shellcheck source=scripts/ingest-lib.sh
source "$REPO_ROOT/scripts/ingest-lib.sh"
ingest_load_admin_token

query=""
if [[ "$DRY_RUN" == "true" ]]; then
  query="dry_run=true"
fi
if [[ -n "$SOURCE" ]]; then
  query="${query:+$query&}source=${SOURCE}"
fi

url="http://127.0.0.1:${PORT}/venue-address-backfill/trigger"
if [[ -n "$query" ]]; then
  url="${url}?${query}"
fi

ingest_log "POST $url"
echo "POST $url" >&2
RESP="$(ingest_curl_json POST "$url")"
printf '%s' "$RESP" | node -e "
const body = JSON.parse(require('fs').readFileSync(0, 'utf8'));
if (!body.ok) {
  const msg = body.error?.message ?? 'Venue address backfill failed';
  console.error('FAIL:', msg);
  process.exit(1);
}
const s = body.data?.summary ?? {};
const dry = s.dry_run === true;
console.log('=== Venue address backfill —', dry ? 'DRY RUN' : 'APPLIED', '===');
console.log('scanned:', s.scanned ?? 0);
console.log('candidate_updates:', s.candidate_updates ?? 0);
console.log('venue_updates:', s.venue_updates ?? 0);
if (!dry) console.log('errors:', s.errors ?? 0);
"
