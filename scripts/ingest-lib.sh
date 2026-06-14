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

# Resolve user --source= to worker scraper key + optional venue filter (internal).
# Sets: INGEST_DISPLAY_SOURCE, INGEST_SCRAPER, INGEST_VENUE_FILTER
ingest_resolve_user_source() {
  local raw="${1:-}"
  local all_venues="${2:-false}"
  local resolver="${REPO_ROOT:-}/scripts/ingest-resolve-source.mjs"

  if [[ ! -f "$resolver" ]] || ! command -v node >/dev/null 2>&1; then
    echo "ingest-resolve-source.mjs requires Node.js" >&2
    return 1
  fi

  local resolve_args=()
  if [[ "$all_venues" == "true" ]]; then
    resolve_args=(--all-venues)
  else
    if [[ -z "$raw" ]]; then
      echo "--source=<key> is required (or use pnpm ingest:promote-all)." >&2
      return 2
    fi
    resolve_args=("$raw")
  fi

  local resolved
  if ! resolved="$(node "$resolver" "${resolve_args[@]}")"; then
    return 2
  fi
  # shellcheck disable=SC1090
  eval "$resolved"
  export INGEST_DISPLAY_SOURCE INGEST_SCRAPER INGEST_VENUE_FILTER
}
