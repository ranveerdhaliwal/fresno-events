import { describe, expect, it } from "vitest";

import {
  BULK_APPROVE_CHANGES_MAX_IDS,
  chunkApproveChangesIds,
  mergeBulkApproveChangesResults,
  parseBulkApproveChangesIds,
  partitionCandidatesForApproveChanges,
  validateBulkApproveChangesIdCount
} from "@/routes/review-approve-changes.utils";

describe("review-approve-changes.utils", () => {
  it("parseBulkApproveChangesIds dedupes ids", () => {
    expect(parseBulkApproveChangesIds(["a", "b", "a"])).toEqual(["a", "b"]);
    expect(parseBulkApproveChangesIds([])).toBeNull();
  });

  it("validateBulkApproveChangesIdCount enforces max", () => {
    const ids = Array.from({ length: BULK_APPROVE_CHANGES_MAX_IDS + 1 }, (_, index) => `id-${index}`);
    expect(validateBulkApproveChangesIdCount(ids)).toContain(String(BULK_APPROVE_CHANGES_MAX_IDS));
  });

  it("partitionCandidatesForApproveChanges filters rows", () => {
    const { toApprove, skipped } = partitionCandidatesForApproveChanges(
      ["ok", "missing", "wrong-status", "no-event", "approved"],
      [
        { id: "ok", status: "needs_changes", matched_event_id: "e1" },
        { id: "wrong-status", status: "pending_review", matched_event_id: "e2" },
        { id: "no-event", status: "needs_changes", matched_event_id: null },
        { id: "approved", status: "approved", matched_event_id: "e3" }
      ]
    );

    expect(toApprove).toEqual(["ok"]);
    expect(skipped).toEqual([
      { id: "missing", reason: "not_found" },
      { id: "wrong-status", reason: "not_needs_changes" },
      { id: "no-event", reason: "missing_matched_event" },
      { id: "approved", reason: "already_approved" }
    ]);
  });

  it("mergeBulkApproveChangesResults aggregates parts", () => {
    expect(
      mergeBulkApproveChangesResults([
        { approved: 2, skipped: [{ id: "a", reason: "not_found" }], failed: [] },
        { approved: 1, skipped: [], failed: [{ id: "b", message: "boom" }] }
      ])
    ).toEqual({
      approved: 3,
      skipped: [{ id: "a", reason: "not_found" }],
      failed: [{ id: "b", message: "boom" }]
    });
  });

  it("chunkApproveChangesIds splits evenly", () => {
    expect(chunkApproveChangesIds(["a", "b", "c", "d", "e"], 2)).toEqual([["a", "b"], ["c", "d"], ["e"]]);
  });
});
