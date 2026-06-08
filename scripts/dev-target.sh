#!/usr/bin/env bash
# Resolve DEV_TARGET → Supabase + regenerate worker .dev.vars from dev-target.env.
set -euo pipefail

DEV_TARGET_FILE="${DEV_TARGET_FILE:-${REPO_ROOT:-$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)}/dev-target.env}"

# Keys read from dev-target.env and written to apps/api/.dev.vars
DEV_TARGET_API_KEYS=(
  ALLOWED_ORIGINS
  ADMIN_REVIEW_TOKEN
  INGEST_URL
  R2_PUBLIC_BASE_URL
  GOOGLE_MAPS_PLATFORM_API_KEY
)

# Keys read from dev-target.env and written to workers/ingest/.dev.vars (besides Supabase + APP_ENV)
DEV_TARGET_INGEST_KEYS=(
  USER_AGENT
  ADMIN_REVIEW_TOKEN
  VISIT_FRESNO_API_TOKEN
  DOWNTOWN_FRESNO_API_KEY
  GEMINI_API_KEY
  ANTHROPIC_API_KEY
  CLOUDFLARE_ACCOUNT_ID
  CLOUDFLARE_API_TOKEN
  MAX_PAGES_PER_SEED
  MAX_CRAWL_DEPTH
  TICKETMASTER_API_KEY
  SEATGEEK_CLIENT_ID
  SEATGEEK_CLIENT_SECRET
  EVENTBRITE_API_KEY
  BANDSINTOWN_APP_ID
  AI_TEXT_PROVIDER
  GEMINI_MODEL
  INGEST_SKIP_VALIDATION
  INGEST_CROSS_SOURCE_DEDUPE
)

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

# Read KEY=value from a .dev.vars file (strips optional quotes).
dev_target_read_dev_var() {
  local file="$1"
  local key="$2"
  if [[ ! -f "$file" ]]; then
    return 0
  fi
  grep -E "^${key}=" "$file" 2>/dev/null | head -1 | sed -E "s/^${key}=//;s/^[\"']//;s/[\"']$//" || true
}

# True if dev-target.env has no assignment for KEY (or only empty / commented).
dev_target_env_key_missing() {
  local key="$1"
  local line
  line="$(grep -E "^${key}=" "$DEV_TARGET_FILE" 2>/dev/null | head -1 || true)"
  [[ -z "$line" ]] && return 0
  local val="${line#*=}"
  val="${val#"${val%%[![:space:]]*}"}"
  val="${val%"${val##*[![:space:]]}"}"
  val="${val#\"}"
  val="${val%\"}"
  val="${val#\'}"
  val="${val%\'}"
  [[ -z "$val" ]]
}

# One-time: copy secrets from legacy hand-edited .dev.vars into dev-target.env.
dev_target_backfill_from_legacy() {
  local api_vars="$REPO_ROOT/apps/api/.dev.vars"
  local ingest_vars="$REPO_ROOT/workers/ingest/.dev.vars"
  local key val added=0

  if [[ ! -f "$api_vars" && ! -f "$ingest_vars" ]]; then
    return 0
  fi

  for key in "${DEV_TARGET_API_KEYS[@]}" "${DEV_TARGET_INGEST_KEYS[@]}"; do
    if ! dev_target_env_key_missing "$key"; then
      continue
    fi
    val="$(dev_target_read_dev_var "$ingest_vars" "$key")"
    if [[ -z "$val" ]]; then
      val="$(dev_target_read_dev_var "$api_vars" "$key")"
    fi
    if [[ -z "$val" ]]; then
      continue
    fi
    printf '%s=%s\n' "$key" "$(dev_target_format_value "$val")" >>"$DEV_TARGET_FILE"
    added=1
  done

  if [[ "$added" -eq 1 ]]; then
    echo "Backfilled missing keys from .dev.vars → $DEV_TARGET_FILE (edit there from now on)" >&2
    dev_target_load_file
  fi
}

dev_target_format_value() {
  local v="$1"
  if [[ -z "$v" ]]; then
    return 1
  fi
  case "$v" in
    *[!a-zA-Z0-9._:/@,-]*)
      local escaped="${v//\\/\\\\}"
      escaped="${escaped//\"/\\\"}"
      printf '"%s"' "$escaped"
      ;;
    *)
      printf '%s' "$v"
      ;;
  esac
}

dev_target_emit_kv() {
  local key="$1"
  local val="$2"
  local formatted
  formatted="$(dev_target_format_value "$val")" || return 0
  echo "${key}=${formatted}"
}

dev_target_ingest_app_env() {
  local explicit="${APP_ENV:-}"
  if [[ -n "$explicit" ]]; then
    echo "$explicit"
    return
  fi
  case "$DEV_TARGET" in
    local) echo "local" ;;
    cloud-dev) echo "dev" ;;
    cloud-prod) echo "production" ;;
    *) echo "local" ;;
  esac
}

dev_target_write_api_dev_vars() {
  local out="$REPO_ROOT/apps/api/.dev.vars"
  local allowed="${ALLOWED_ORIGINS:-}"
  local admin_token="${ADMIN_REVIEW_TOKEN:-}"
  local r2_base="${R2_PUBLIC_BASE_URL:-}"

  {
    echo "# AUTO-GENERATED — do not edit. Source: dev-target.env"
    echo "# Regenerate: pnpm env:local | env:cloud-dev | env:cloud-prod"
    echo "# Target: $DEV_TARGET ($DEV_TARGET_LABEL)"
    echo ""
    echo "# Vite dev server — must match scripts/dev-ports.env (FRESNO_WEB_PORT)"
    dev_target_emit_kv "ALLOWED_ORIGINS" "$allowed"
    echo ""
    echo "# Supabase (from dev-target.env)"
    dev_target_emit_kv "SUPABASE_URL" "$SUPABASE_URL"
    dev_target_emit_kv "SUPABASE_SERVICE_ROLE_KEY" "$SUPABASE_SERVICE_ROLE_KEY"
    echo ""
    echo "# Shared with workers/ingest (dev-target.env)"
    dev_target_emit_kv "ADMIN_REVIEW_TOKEN" "$admin_token"
    dev_target_emit_kv "INGEST_URL" "${INGEST_URL:-http://127.0.0.1:8788}"
    if [[ -n "${GOOGLE_MAPS_PLATFORM_API_KEY:-}" ]]; then
      dev_target_emit_kv "GOOGLE_MAPS_PLATFORM_API_KEY" "${GOOGLE_MAPS_PLATFORM_API_KEY}"
    else
      echo "# GOOGLE_MAPS_PLATFORM_API_KEY=  # Geocoding, Weather, Air Quality, Pollen, …"
    fi
    if [[ -n "$r2_base" ]]; then
      echo ""
      dev_target_emit_kv "R2_PUBLIC_BASE_URL" "$r2_base"
    else
      echo ""
      echo "# R2_PUBLIC_BASE_URL="
    fi
  } >"$out"
}

dev_target_write_ingest_dev_vars() {
  local out="$REPO_ROOT/workers/ingest/.dev.vars"
  local app_env
  local key val

  app_env="$(dev_target_ingest_app_env)"

  {
    echo "# AUTO-GENERATED — do not edit. Source: dev-target.env"
    echo "# Regenerate: pnpm env:local | env:cloud-dev | env:cloud-prod"
    echo "# Target: $DEV_TARGET ($DEV_TARGET_LABEL)"
    echo ""
    dev_target_emit_kv "APP_ENV" "$app_env"
    for key in "${DEV_TARGET_INGEST_KEYS[@]}"; do
      val="${!key:-}"
      dev_target_emit_kv "$key" "$val"
    done
    echo ""
    echo "# Supabase (from dev-target.env)"
    dev_target_emit_kv "SUPABASE_URL" "$SUPABASE_URL"
    dev_target_emit_kv "SUPABASE_SERVICE_ROLE_KEY" "$SUPABASE_SERVICE_ROLE_KEY"
    echo ""
    echo "# Optional ticketing (set in dev-target.env to enable)"
    echo "# TICKETMASTER_API_KEY="
    echo "# SEATGEEK_CLIENT_ID="
    echo "# SEATGEEK_CLIENT_SECRET="
    echo "# EVENTBRITE_API_KEY="
    echo "# BANDSINTOWN_APP_ID="
    echo ""
    echo "# Optional LLM overrides (set in dev-target.env)"
    echo "# AI_TEXT_PROVIDER=gemini"
    echo "# GEMINI_MODEL=gemini-2.5-flash"
    echo "# INGEST_SKIP_VALIDATION=true"
  } >"$out"
}

dev_target_sync_dev_vars() {
  dev_target_resolve || return 1
  REPO_ROOT="$(dev_target_repo_root)"

  dev_target_backfill_from_legacy

  if [[ -z "${ADMIN_REVIEW_TOKEN:-}" ]]; then
    echo "ADMIN_REVIEW_TOKEN is empty in $DEV_TARGET_FILE" >&2
    return 1
  fi

  dev_target_write_api_dev_vars
  dev_target_write_ingest_dev_vars

  echo "Regenerated .dev.vars from dev-target.env → $DEV_TARGET_LABEL"
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
  echo "Source of truth: $DEV_TARGET_FILE"
  echo ""
  echo "Data path:"
  echo "  /admin UI → VITE_API_URL (local Worker) → apps/api SUPABASE_URL → Postgres"
  echo ""

  for label in "apps/api/.dev.vars" "workers/ingest/.dev.vars"; do
    local f="$REPO_ROOT/$label"
    if [[ ! -f "$f" ]]; then
      echo "  $label: missing — run pnpm env:${DEV_TARGET}"
      continue
    fi
    if head -1 "$f" | grep -q 'AUTO-GENERATED'; then
      local file_url
      file_url="$(dev_target_read_dev_var "$f" "SUPABASE_URL")"
      if [[ "$file_url" == "$SUPABASE_URL" ]]; then
        echo "  $label: generated, in sync"
      else
        echo "  $label: generated, OUT OF SYNC (has $file_url) — run pnpm env:${DEV_TARGET}"
      fi
    else
      echo "  $label: legacy (not auto-generated) — run pnpm env:${DEV_TARGET}"
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
    echo "DEV_TARGET=$next" >>"$DEV_TARGET_FILE"
  fi

  export REPO_ROOT
  dev_target_sync_dev_vars
}
