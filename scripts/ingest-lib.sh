#!/usr/bin/env bash
# Shared helpers for ingest shell scripts.

ingest_log() {
  if [[ "${INGEST_VERBOSE:-}" == "1" ]]; then
    echo "$@" >&2
  fi
}

ingest_load_admin_token() {
  if [[ -n "${ADMIN_REVIEW_TOKEN:-}" ]]; then
    return 0
  fi

  local dev_vars="${REPO_ROOT:-}/workers/ingest/.dev.vars"
  if [[ -f "$dev_vars" ]]; then
    local line
    line="$(grep -E '^ADMIN_REVIEW_TOKEN=' "$dev_vars" | head -1 || true)"
    if [[ -n "$line" ]]; then
      ADMIN_REVIEW_TOKEN="${line#ADMIN_REVIEW_TOKEN=}"
      ADMIN_REVIEW_TOKEN="${ADMIN_REVIEW_TOKEN%\"}"
      ADMIN_REVIEW_TOKEN="${ADMIN_REVIEW_TOKEN#\"}"
      export ADMIN_REVIEW_TOKEN
    fi
  fi

  if [[ -z "${ADMIN_REVIEW_TOKEN:-}" ]]; then
    echo "ADMIN_REVIEW_TOKEN not set. Export it or set it in workers/ingest/.dev.vars" >&2
    return 1
  fi
}

ingest_curl_json() {
  local method="$1"
  local url="$2"
  curl -fsS -X "$method" -H "x-admin-token: ${ADMIN_REVIEW_TOKEN}" "$url"
}

# Read .data.summary.<field> from ingest worker JSON (jq or node).
ingest_json_summary_field() {
  local json="$1"
  local field="$2"

  if command -v jq >/dev/null 2>&1; then
    echo "$json" | jq -r ".data.summary.${field} // 0"
    return
  fi

  if command -v node >/dev/null 2>&1; then
    printf '%s' "$json" | node -e "
      const field = process.argv[1];
      const data = JSON.parse(require('fs').readFileSync(0, 'utf8'));
      const value = data?.data?.summary?.[field];
      process.stdout.write(String(value ?? 0));
    " "$field"
    return
  fi

  echo "ingest_json_summary_field requires jq or node" >&2
  return 1
}

# Same as ingest_json_summary_field but returns "true" / "false" for booleans.
ingest_json_summary_bool() {
  local json="$1"
  local field="$2"

  if command -v jq >/dev/null 2>&1; then
    echo "$json" | jq -r ".data.summary.${field} // false"
    return
  fi

  if command -v node >/dev/null 2>&1; then
    printf '%s' "$json" | node -e "
      const field = process.argv[1];
      const data = JSON.parse(require('fs').readFileSync(0, 'utf8'));
      const value = data?.data?.summary?.[field];
      process.stdout.write(value === true ? 'true' : 'false');
    " "$field"
    return
  fi

  echo "ingest_json_summary_bool requires jq or node" >&2
  return 1
}

# Print preflight health + persist preview. Never dumps raw JSON (see ingest:dev for full logs).
ingest_check_summaries_json() {
  local resp="$1"
  ingest_print_preflight_summary "$resp"
}

ingest_print_preflight_summary() {
  local resp="$1"
  local script="${REPO_ROOT:-}/scripts/ingest-print-preflight-summary.mjs"
  if [[ ! -f "$script" ]] || ! command -v node >/dev/null 2>&1; then
    echo "Preflight summary requires Node.js and $script" >&2
    return 1
  fi
  printf '%s' "$resp" | node "$script"
}

ingest_print_relink_summary() {
  local resp="$1"
  local script="${REPO_ROOT:-}/scripts/ingest-print-relink-summary.mjs"
  if [[ ! -f "$script" ]] || ! command -v node >/dev/null 2>&1; then
    echo "Relink summary requires Node.js and $script" >&2
    return 1
  fi
  printf '%s' "$resp" | node "$script"
}

# Map candidate eventSource values (e.g. scrape:www.savemartcenter.com) to venue-ingest + --venue key.
ingest_resolve_event_source_alias() {
  local src="${SOURCE:-}"
  [[ -n "$src" ]] || return 0
  [[ -n "${VENUE:-}" ]] && return 0
  [[ "$src" == *","* ]] && return 0

  case "$src" in
    ticketmaster | venunite | seatgeek | eventbrite | bandsintown | ai-discovery | venue-ingest | all)
      return 0
      ;;
  esac

  local repo="${REPO_ROOT:-}"
  local config event_src venue_key
  for config in "$repo"/workers/ingest/src/venues/*/venue.config.json; do
    [[ -f "$config" ]] || continue
    event_src="$(grep -E '"eventSource"' "$config" | sed -E 's/.*"eventSource"[[:space:]]*:[[:space:]]*"([^"]+)".*/\1/' | head -1)"
    venue_key="$(grep -E '"key"' "$config" | sed -E 's/.*"key"[[:space:]]*:[[:space:]]*"([^"]+)".*/\1/' | head -1)"
    if [[ "$event_src" == "$src" || "$venue_key" == "$src" ]]; then
      VENUE="$venue_key"
      SOURCE="venue-ingest"
      echo "Note: resolved --source=$src → venue-ingest --venue=$venue_key (event source on candidates, not a scraper key)." >&2
      return 0
    fi
  done
}

# When --venue is set, Fresno venues always use venue-ingest (method is per venue.config.json).
ingest_apply_venue_source_defaults() {
  ingest_resolve_event_source_alias

  if [[ -z "${VENUE:-}" ]]; then
    return 0
  fi
  if [[ -z "${SOURCE:-}" ]]; then
    SOURCE="venue-ingest"
    return 0
  fi
  if [[ "$SOURCE" != "venue-ingest" && "$SOURCE" != "all" ]]; then
    echo "Cannot combine --venue with --source=$SOURCE (venues use source=venue-ingest)." >&2
    return 2
  fi
}
