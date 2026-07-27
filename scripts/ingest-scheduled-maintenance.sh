#!/usr/bin/env bash
# Post-promote maintenance for scheduled local ingest: relink + orphan cleanup.
# Always dry-runs first; apply only when preview is clean (errors=0).
# Orphan apply is skipped when wouldDelete=0; aborted when over INGEST_SCHEDULED_MAX_ORPHAN_DELETE.
#
# Sourced by ingest-scheduled-local.sh — not meant to run standalone.

scheduled_load_ports() {
  # shellcheck source=scripts/dev-ports.env
  source "${REPO_ROOT}/scripts/dev-ports.env"
  API_ORIGIN="http://127.0.0.1:${FRESNO_API_PORT:-8790}"
}

scheduled_ensure_api_worker() {
  scheduled_load_ports
  if curl -fsS "${API_ORIGIN}/health" >/dev/null 2>&1; then
    echo "[scheduled] Reusing API worker on ${API_ORIGIN}"
    return 0
  fi

  echo "[scheduled] Starting API worker on ${API_ORIGIN}"
  bash "${REPO_ROOT}/scripts/with-dev-ports.sh" pnpm --filter @fresno-events/api dev &
  SCHEDULED_API_PID=$!
  for _ in $(seq 1 90); do
    if curl -fsS "${API_ORIGIN}/health" >/dev/null 2>&1; then
      echo "[scheduled] API worker ready"
      return 0
    fi
    sleep 2
  done

  echo "[scheduled] API worker failed to start on ${API_ORIGIN}" >&2
  scheduled_record_step "api-worker" "failed" "health check timeout"
  return 1
}

scheduled_run_relink_maintenance() {
  echo ""
  echo ">>> pnpm ingest:relink --dry-run"
  if ! pnpm ingest:relink --dry-run; then
    scheduled_record_step "relink-dry-run" "failed" "errors or non-zero exit"
    echo "[scheduled] Skipping relink apply — dry-run failed." >&2
    return 1
  fi
  scheduled_record_step "relink-dry-run" "ok" "preview passed"

  echo ""
  echo ">>> pnpm ingest:relink"
  if pnpm ingest:relink; then
    scheduled_record_step "relink-apply" "ok" "applied"
    return 0
  fi

  scheduled_record_step "relink-apply" "failed" "errors or non-zero exit"
  return 1
}

scheduled_orphan_preview_json() {
  scheduled_load_ports
  # shellcheck source=scripts/ingest-lib.sh
  source "${REPO_ROOT}/scripts/ingest-lib.sh"
  ingest_load_admin_token
  curl -fsS -X POST \
    -H "x-admin-token: ${ADMIN_REVIEW_TOKEN}" \
    -H "Content-Type: application/json" \
    "${API_ORIGIN}/review/ops/published-orphan-cleanup?dry_run=true"
}

scheduled_run_orphan_maintenance() {
  scheduled_ensure_api_worker

  echo ""
  echo ">>> pnpm review:orphan-cleanup --dry-run"
  local preview
  preview="$(scheduled_orphan_preview_json)"
  if ! ingest_print_orphan_cleanup_summary "$preview"; then
    scheduled_record_step "orphan-dry-run" "failed" "errors or non-zero exit"
    echo "[scheduled] Skipping orphan apply — dry-run failed." >&2
    return 1
  fi

  local would_delete errors
  would_delete="$(ingest_json_summary_field "$preview" "wouldDelete")"
  errors="$(ingest_json_summary_field "$preview" "errors")"
  scheduled_record_step "orphan-dry-run" "ok" "wouldDelete=${would_delete} errors=${errors}"

  if [[ "${would_delete:-0}" -eq 0 ]]; then
    echo "[scheduled] Orphan cleanup apply skipped — nothing to delete."
    scheduled_record_step "orphan-apply" "skipped" "wouldDelete=0"
    return 0
  fi

  local max_delete="${INGEST_SCHEDULED_MAX_ORPHAN_DELETE:-50}"
  if [[ "${would_delete:-0}" -gt "${max_delete}" && "${INGEST_SCHEDULED_FORCE_ORPHAN:-}" != "1" ]]; then
    echo "[scheduled] Orphan apply aborted — wouldDelete=${would_delete} exceeds INGEST_SCHEDULED_MAX_ORPHAN_DELETE=${max_delete}." >&2
    echo "[scheduled] Set INGEST_SCHEDULED_FORCE_ORPHAN=1 to override after manual review." >&2
    scheduled_record_step "orphan-apply" "aborted" "wouldDelete=${would_delete} max=${max_delete}"
    return 1
  fi

  echo ""
  echo ">>> pnpm review:orphan-cleanup"
  if pnpm review:orphan-cleanup; then
    scheduled_record_step "orphan-apply" "ok" "deleted=${would_delete}"
    return 0
  fi

  scheduled_record_step "orphan-apply" "failed" "apply errors"
  return 1
}

scheduled_emit_cursor_review() {
  local manifest="${LOG_DIR}/run-${STAMP}-cursor-review.txt"
  {
    echo "=== Cursor review — scheduled ingest ${STAMP} ==="
    echo ""
    echo "Log file: ${LOG}"
    echo "DEV_TARGET: ${DEV_TARGET:-unknown} (from dev-target.env)"
    echo ""
    echo "Verify each step in the log above."
    echo "  - post-promote: detail-backfill, enrich, reject-exclusions (away games, Shen Yun), venue addresses"
    echo "  - relink: dry-run must show errors=0 before apply"
    echo "  - orphan cleanup: apply only when wouldDelete>0 and under max (${INGEST_SCHEDULED_MAX_ORPHAN_DELETE:-50})"
    echo "After maintenance: agent runbook (INGEST_LOCAL_OPS.md) → pre-approve-audit → bulk-approve → bulk-approve-changes if needed"
    echo ""
    echo "Step results:"
    local row name status detail
    for row in "${SCHEDULED_REVIEW_STEPS[@]}"; do
      IFS='|' read -r name status detail <<< "$row"
      printf "  - %-22s %s" "$name" "$status"
      if [[ -n "$detail" ]]; then
        printf " (%s)" "$detail"
      fi
      echo ""
    done
    echo ""
    echo "Suggested Cursor prompt:"
    echo "  Read ${LOG} and run-${STAMP}-cursor-review.txt. For each >>> step, confirm"
    echo "  validation/preflight ok, relink errors=0, orphan wouldDelete is expected,"
    echo "  no ingest_runs stuck running. Flag anything surprising before bulk approve."
    echo ""
  } | tee "$manifest"

  echo "[scheduled] Cursor review manifest: ${manifest}"
}

scheduled_maintenance_had_failure() {
  local row name status _detail
  for row in "${SCHEDULED_REVIEW_STEPS[@]}"; do
    IFS='|' read -r name status _detail <<< "$row"
    if [[ "$status" == "failed" || "$status" == "aborted" ]]; then
      return 0
    fi
  done
  return 1
}
