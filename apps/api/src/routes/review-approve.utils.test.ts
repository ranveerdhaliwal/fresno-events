import { describe, expect, it } from "vitest";

import {
  BULK_APPROVE_MAX_IDS,
  chunkIds,
  mergeBulkApproveResults,
  parseBulkApproveAllLimit,
  parseBulkApproveIds,
  partitionCandidatesForApprove,
  resolveBulkApprovePriority,
  validateBulkApproveIdCount
} from "@/routes/review-approve.utils";

describe("parseBulkApproveIds", () => {
  it("dedupes string ids", () => {
    expect(parseBulkApproveIds(["a", "b", "a"])).toEqual(["a", "b"]);
  });

  it("returns null for empty array", () => {
    expect(parseBulkApproveIds([])).toBeNull();
  });
});

describe("validateBulkApproveIdCount", () => {
  it("rejects more than max ids", () => {
    const ids = Array.from({ length: BULK_APPROVE_MAX_IDS + 1 }, (_, i) => `id-${i}`);
    expect(validateBulkApproveIdCount(ids)).toContain("100");
  });
});

describe("resolveBulkApprovePriority", () => {
  it("uses explicit priority when provided", () => {
    expect(resolveBulkApprovePriority({ suggestedPriority: 2 }, 4)).toBe(4);
  });

  it("uses suggested_priority when explicit omitted", () => {
    expect(resolveBulkApprovePriority({ suggestedPriority: 2 })).toBe(2);
  });

  it("defaults to 5 when no suggested priority", () => {
    expect(resolveBulkApprovePriority({})).toBe(5);
  });

  it("clamps suggested or explicit P0 to default for organic candidates", () => {
    expect(resolveBulkApprovePriority({ suggestedPriority: 0 })).toBe(5);
    expect(resolveBulkApprovePriority({ suggestedPriority: 2 }, 0)).toBe(5);
  });
});

describe("partitionCandidatesForApprove", () => {
  it("skips non-pending and missing rows", () => {
    const result = partitionCandidatesForApprove(
      ["a", "b", "c", "d"],
      [
        { id: "a", status: "pending_review" },
        { id: "b", status: "approved" },
        { id: "c", status: "rejected" }
      ]
    );

    expect(result.toApprove).toEqual(["a"]);
    expect(result.skipped).toEqual([
      { id: "b", reason: "already_approved" },
      { id: "c", reason: "not_pending" },
      { id: "d", reason: "not_found" }
    ]);
  });
});

describe("mergeBulkApproveResults", () => {
  it("aggregates approved, skipped, and failed", () => {
    const merged = mergeBulkApproveResults([
      { approved: 2, skipped: [{ id: "x", reason: "not_found" }], failed: [] },
      { approved: 1, skipped: [], failed: [{ id: "y", message: "boom" }] }
    ]);

    expect(merged).toEqual({
      approved: 3,
      skipped: [{ id: "x", reason: "not_found" }],
      failed: [{ id: "y", message: "boom" }]
    });
  });
});

describe("chunkIds", () => {
  it("splits ids into chunks of 100", () => {
    const ids = Array.from({ length: 250 }, (_, i) => `id-${i}`);
    const chunks = chunkIds(ids, 100);
    expect(chunks).toHaveLength(3);
    expect(chunks[0]).toHaveLength(100);
    expect(chunks[2]).toHaveLength(50);
  });
});

describe("parseBulkApproveAllLimit", () => {
  it("caps limit at 5000", () => {
    expect(parseBulkApproveAllLimit(9000)).toBe(5000);
  });
});
