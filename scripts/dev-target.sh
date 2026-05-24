#!/usr/bin/env bash
# Resolve DEV_TARGET → SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY for workers.
set -euo pipefail

DEV_TARGET_FILE="${DEV_TARGET_FILE:-${REPO_ROOT:-$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)}/dev-target.env}"

dev_target_repo_root() {
  if [[ -n "${REPO_ROOT:-}" ]]; then
    echo "$REPO_ROOT"
    return
  fi
  cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd
}

dev_target_load_file() {
  REPO_ROOT="$(dev_target_repo_root)"
  DEV_TARGET_FILE="${DEV_TARGET_FILE:-$REPO_ROOT/dev-target.env}"

  if [[ ! -f "$DEV_TARGET_FILE" ]]; then
    echo "Missing $DEV_TARGET_FILE — copy dev-target.env.example and fill in keys." >&2
    echo "  cp dev-target.env.example dev-target.env" >&2
    return 1
  fi

  # shellcheck disable=SC1090
  set -a
  source "$DEV_TARGET_FILE"
  set +a

  DEV_TARGET="${DEV_TARGET:-cloud-dev}"
}

dev_target_resolve() {
  dev_target_load_file || return 1

  case "$DEV_TARGET" in
    local)
      SUPABASE_URL="${SUPABASE_URL_LOCAL:-}"
      SUPABASE_SERVICE_ROLE_KEY="${SUPABASE_SERVICE_ROLE_KEY_LOCAL:-}"
      DEV_TARGET_LABEL="local Supabase (Docker)"
      ;;
    cloud-dev)
      SUPABASE_URL="${SUPABASE_URL_CLOUD_DEV:-}"
      SUPABASE_SERVICE_ROLE_KEY="${SUPABASE_SERVICE_ROLE_KEY_CLOUD_DEV:-}"
      DEV_TARGET_LABEL="cloud dev (what-up-fresno-dev)"
      ;;
    cloud-prod)
      SUPABASE_URL="${SUPABASE_URL_CLOUD_PROD:-}"
      SUPABASE_SERVICE_ROLE_KEY="${SUPABASE_SERVICE_ROLE_KEY_CLOUD_PROD:-}"
      DEV_TARGET_LABEL="cloud PRODUCTION"
      ;;
    *)
      echo "Invalid DEV_TARGET=$DEV_TARGET (use local, cloud-dev, or cloud-prod)" >&2
      return 1
      ;;
  esac

  if [[ -z "$SUPABASE_URL" || -z "$SUPABASE_SERVICE_ROLE_KEY" ]]; then
    echo "DEV_TARGET=$DEV_TARGET is set but URL or service role key is empty in $DEV_TARGET_FILE" >&2
    return 1
  fi

  export DEV_TARGET SUPABASE_URL SUPABASE_SERVICE_ROLE_KEY DEV_TARGET_LABEL
}

dev_target_is_local() {
  [[ "${DEV_TARGET:-}" == "local" ]]
}

dev_target_patch_file() {
  local file="$1"
  local url="$2"
  local key="$3"
  local target="$4"
  local tmp

  if [[ ! -f "$file" ]]; then
    echo "Skip $file (not found — copy from .dev.vars.example first)" >&2
    return 0
  fi

  tmp="$(mktemp)"
  awk -v url="$url" -v key="$key" -v target="$target" '
    BEGIN { wrote_header = 0 }
    /^# dev-target:/ { next }
    /^SUPABASE_URL=/ { if (!wrote_url) { print "SUPABASE_URL=\"" url "\""; wrote_url = 1 }; next }
    /^SUPABASE_SERVICE_ROLE_KEY=/ { if (!wrote_key) { print "SUPABASE_SERVICE_ROLE_KEY=\"" key "\""; wrote_key = 1 }; next }
    { print }
    END {
      if (!wrote_url) print "SUPABASE_URL=\"" url "\""
      if (!wrote_key) print "SUPABASE_SERVICE_ROLE_KEY=\"" key "\""
    }
  ' "$file" > "$tmp"

  {
    echo "# dev-target: ${target} (set by pnpm env:local|cloud-dev|cloud-prod)"
    cat "$tmp"
  } > "$file"
  rm -f "$tmp"
}

dev_target_sync_dev_vars() {
  dev_target_resolve || return 1
  REPO_ROOT="$(dev_target_repo_root)"

  dev_target_patch_file "$REPO_ROOT/apps/api/.dev.vars" "$SUPABASE_URL" "$SUPABASE_SERVICE_ROLE_KEY" "$DEV_TARGET"
  dev_target_patch_file "$REPO_ROOT/workers/ingest/.dev.vars" "$SUPABASE_URL" "$SUPABASE_SERVICE_ROLE_KEY" "$DEV_TARGET"

  echo "Synced Supabase → $DEV_TARGET_LABEL"
  echo "  SUPABASE_URL=$SUPABASE_URL"
  echo "  apps/api/.dev.vars"
  echo "  workers/ingest/.dev.vars"
  echo "Restart pnpm dev:api and pnpm ingest:dev if they are running."
}

dev_target_print_status() {
  dev_target_resolve || return 1
  REPO_ROOT="$(dev_target_repo_root)"

  echo "DEV_TARGET=$DEV_TARGET ($DEV_TARGET_LABEL)"
  echo "Resolved SUPABASE_URL=$SUPABASE_URL"
  echo ""
  echo "Data path:"
  echo "  /admin UI → VITE_API_URL (local Worker) → apps/api SUPABASE_URL → Postgres"
  echo ""

  for label in "apps/api/.dev.vars" "workers/ingest/.dev.vars"; do
    local f="$REPO_ROOT/$label"
    if [[ ! -f "$f" ]]; then
      echo "  $label: missing"
      continue
    fi
    local file_url
    file_url="$(grep -E '^SUPABASE_URL=' "$f" | head -1 | sed 's/^SUPABASE_URL=//;s/^"//;s/"$//' || true)"
    if [[ "$file_url" == "$SUPABASE_URL" ]]; then
      echo "  $label: in sync"
    else
      echo "  $label: OUT OF SYNC (has $file_url) — run pnpm env:${DEV_TARGET}"
    fi
  done

  local vite_api="${VITE_API_URL:-}"
  if [[ -z "$vite_api" && -f "$REPO_ROOT/apps/web/.env.local" ]]; then
    vite_api="$(grep -E '^VITE_API_URL=' "$REPO_ROOT/apps/web/.env.local" | head -1 | sed 's/^VITE_API_URL=//;s/^"//;s/"$//' || true)"
  fi
  echo ""
  echo "Web admin uses API at: ${vite_api:-not set (mocks or with-dev-ports default)}"
}

dev_target_set() {
  local next="$1"
  REPO_ROOT="$(dev_target_repo_root)"
  DEV_TARGET_FILE="$REPO_ROOT/dev-target.env"

  if [[ ! -f "$DEV_TARGET_FILE" ]]; then
    cp "$REPO_ROOT/dev-target.env.example" "$DEV_TARGET_FILE"
    echo "Created $DEV_TARGET_FILE from example — fill in keys, then run pnpm env:local (or cloud-dev)" >&2
    return 1
  fi

  case "$next" in
    local|cloud-dev|cloud-prod) ;;
    *)
      echo "Usage: pnpm env:local | env:cloud-dev | env:cloud-prod" >&2
      return 1
      ;;
  esac

  if grep -q '^DEV_TARGET=' "$DEV_TARGET_FILE"; then
    sed -i "s/^DEV_TARGET=.*/DEV_TARGET=$next/" "$DEV_TARGET_FILE"
  else
    echo "DEV_TARGET=$next" >> "$DEV_TARGET_FILE"
  fi

  export REPO_ROOT
  dev_target_sync_dev_vars
}
