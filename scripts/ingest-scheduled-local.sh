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
}
trap cleanup EXIT INT TERM

echo "=== Fresno ingest scheduled run $STAMP ==="
echo "DEV_TARGET from dev-target.env; log: $LOG"

cd "$REPO_ROOT"
pnpm env:status || true

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

run_step pnpm ingest:promote --source=ticketmaster --no-enrich
run_step pnpm ingest:promote --source=venunite --no-enrich
run_step pnpm ingest:promote-all --no-enrich
run_step pnpm ingest:detail-backfill --all
run_step pnpm ingest:enrich --all
run_step pnpm db:backfill-addresses

echo ""
echo "=== Scheduled run complete $STAMP ==="
