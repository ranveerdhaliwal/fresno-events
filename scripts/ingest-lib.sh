#!/usr/bin/env bash
# Shared helpers for ingest shell scripts.

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

# Exit 1 if any summary in a dry-run / trigger response failed validation.
ingest_check_summaries_json() {
  local resp="$1"
  if ! command -v jq >/dev/null 2>&1; then
    echo "$resp"
    return 0
  fi

  local failed=0
  local count
  count="$(echo "$resp" | jq '.data.summaries | length')"
  if [[ "$count" == "0" || "$count" == "null" ]]; then
    echo "FAIL: no summaries in response" >&2
    return 1
  fi

  local i=0
  while [[ "$i" -lt "$count" ]]; do
    local src ok val_ok events hard
    src="$(echo "$resp" | jq -r ".data.summaries[$i].source")"
    ok="$(echo "$resp" | jq -r ".data.summaries[$i].ok // false")"
    val_ok="$(echo "$resp" | jq -r ".data.summaries[$i].validation.ok // false")"
    events="$(echo "$resp" | jq -r ".data.summaries[$i].events_found // 0")"
    hard="$(echo "$resp" | jq -c ".data.summaries[$i].validation.hard // []")"

    if [[ "$ok" == "true" && "$val_ok" == "true" ]]; then
      echo "PASS $src: events_found=$events validation.ok=true" >&2
    else
      echo "FAIL $src: ok=$ok validation.ok=$val_ok events_found=$events hard=$hard" >&2
      failed=1
    fi
    i=$((i + 1))
  done

  return "$failed"
}
