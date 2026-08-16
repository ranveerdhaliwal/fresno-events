#!/usr/bin/env bash
# Full local ingest pipeline against the current DEV_TARGET (use cloud-dev for live DB).
# Prerequisite: nothing else holding INGEST_PORT (default 8788).
#
# Usage:
#   pnpm ingest:scheduled-local
#   bash scripts/ingest-scheduled-local.sh

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PORT="${INGEST_PORT:-8788}"
INGEST_PID=""
SCHEDULED_API_PID=""
SCHEDULED_REVIEW_STEPS=()
LOG_DIR="${INGEST_SCHEDULED_LOG_DIR:-/tmp/fresno-ingest-scheduled}"
mkdir -p "$LOG_DIR"
STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
LOG="$LOG_DIR/run-${STAMP}.log"

exec > >(tee -a "$LOG") 2>&1

cleanup() {
  if [[ -n "$INGEST_PID" ]] && kill -0 "$INGEST_PID" 2>/dev/null; then
    echo "[scheduled] Stopping ingest worker (pid $INGEST_PID)"
    kill "$INGEST_PID" 2>/dev/null || true
    wait "$INGEST_PID" 2>/dev/null || true
  fi
  if [[ -n "${SCHEDULED_API_PID:-}" ]] && kill -0 "$SCHEDULED_API_PID" 2>/dev/null; then
    echo "[scheduled] Stopping API worker (pid $SCHEDULED_API_PID)"
    kill "$SCHEDULED_API_PID" 2>/dev/null || true
    wait "$SCHEDULED_API_PID" 2>/dev/null || true
  fi
}
trap cleanup EXIT INT TERM

echo "=== Fresno ingest scheduled run $STAMP ==="
echo "DEV_TARGET from dev-target.env; log: $LOG"

cd "$REPO_ROOT"
pnpm env:status || true
if [[ -f "$REPO_ROOT/dev-target.env" ]]; then
  DEV_TARGET="$(grep -E '^DEV_TARGET=' "$REPO_ROOT/dev-target.env" | head -1 | cut -d= -f2-)"
  export DEV_TARGET
fi

if curl -fsS "http://127.0.0.1:${PORT}/health" >/dev/null 2>&1; then
  echo "[scheduled] Reusing ingest worker on port ${PORT}"
else
  echo "[scheduled] Starting ingest worker on port ${PORT}"
  pnpm ingest:dev &
  INGEST_PID=$!
  for _ in $(seq 1 90); do
    if curl -fsS "http://127.0.0.1:${PORT}/health" >/dev/null 2>&1; then
      echo "[scheduled] Ingest worker ready"
      break
    fi
    sleep 2
  done
  if ! curl -fsS "http://127.0.0.1:${PORT}/health" >/dev/null 2>&1; then
    echo "[scheduled] Ingest worker failed to start on port ${PORT}" >&2
    exit 1
  fi
fi

run_step() {
  echo ""
  echo ">>> $*"
  "$@"
}

scheduled_record_step() {
  local name="$1"
  local status="$2"
  local detail="${3:-}"
  SCHEDULED_REVIEW_STEPS+=("${name}|${status}|${detail}")
}

# One source FAIL (e.g. Rainbow 0 events) must not skip post-promote / maintenance.
run_promote_step() {
  local name="$1"
  local detail="${2:-}"
  shift 2
  if run_step "$@"; then
    scheduled_record_step "$name" "ok" "$detail"
    return 0
  fi
  scheduled_record_step "$name" "failed" "continuing pipeline"
  echo "[scheduled] $name failed — continuing so the rest of the workflow still runs." >&2
}

run_promote_step "promote-ticketmaster" "" pnpm ingest:promote --source=ticketmaster --no-enrich
run_promote_step "promote-venunite" "" pnpm ingest:promote --source=venunite --no-enrich
run_promote_step "promote-all" "venue-ingest" pnpm ingest:promote-all --no-enrich
if run_step pnpm ingest:post-promote; then
  scheduled_record_step "post-promote" "ok" "detail-backfill, enrich, reject-exclusions, addresses"
else
  scheduled_record_step "post-promote" "failed" ""
  exit 1
fi

# shellcheck source=scripts/ingest-scheduled-maintenance.sh
source "$REPO_ROOT/scripts/ingest-scheduled-maintenance.sh"
# shellcheck source=scripts/ingest-lib.sh
source "$REPO_ROOT/scripts/ingest-lib.sh"

if [[ "${INGEST_SCHEDULED_SKIP_MAINTENANCE:-}" != "1" ]]; then
  scheduled_run_relink_maintenance || true
  scheduled_run_orphan_maintenance || true
else
  echo "[scheduled] Skipping relink + orphan maintenance (INGEST_SCHEDULED_SKIP_MAINTENANCE=1)"
  scheduled_record_step "maintenance" "skipped" "INGEST_SCHEDULED_SKIP_MAINTENANCE=1"
fi

scheduled_emit_cursor_review

if scheduled_maintenance_had_failure; then
  echo "[scheduled] Maintenance had failures — read cursor review manifest before bulk approve." >&2
  exit 1
fi

echo ""
echo "=== Scheduled run complete $STAMP ==="
