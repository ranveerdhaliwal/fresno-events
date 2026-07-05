import assert from "node:assert/strict";
import { test } from "node:test";

import { printOrphanCleanupSummary } from "./ingest-print-orphan-cleanup-summary.mjs";

test("printOrphanCleanupSummary returns 0 for clean dry-run", () => {
  const code = printOrphanCleanupSummary({
    ok: true,
    data: {
      dryRun: true,
      message: "No published content duplicates found.",
      summary: {
        scheduledScanned: 100,
        duplicateGroups: 0,
        wouldDelete: 0,
        deleted: 0,
        errors: 0,
        deletions: []
      }
    }
  });
  assert.equal(code, 0);
});

test("printOrphanCleanupSummary returns 1 when errors present", () => {
  const code = printOrphanCleanupSummary({
    ok: true,
    data: {
      dryRun: false,
      message: "Deleted 2 orphan published event(s).",
      summary: {
        scheduledScanned: 100,
        duplicateGroups: 2,
        wouldDelete: 2,
        deleted: 1,
        errors: 1,
        deletions: []
      }
    }
  });
  assert.equal(code, 1);
});

test("printOrphanCleanupSummary returns 1 when ok is false", () => {
  const code = printOrphanCleanupSummary({
    ok: false,
    error: { message: "Unauthorized" }
  });
  assert.equal(code, 1);
});
