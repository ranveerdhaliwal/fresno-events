import { describe, expect, it } from "vitest";

import {
  BULK_REJECT_MAX_IDS,
  parseBulkRejectIds,
  validateBulkRejectIdCount
} from "@/routes/review-bulk-reject.utils";

describe("parseBulkRejectIds", () => {
  it("dedupes non-empty string ids", () => {
    expect(parseBulkRejectIds(["a", "b", "a"])).toEqual(["a", "b"]);
  });

  it("returns null for empty or invalid input", () => {
    expect(parseBulkRejectIds([])).toBeNull();
    expect(parseBulkRejectIds(["", "  "])).toBeNull();
    expect(parseBulkRejectIds("not-an-array")).toBeNull();
  });
});

describe("validateBulkRejectIdCount", () => {
  it("rejects more than max ids", () => {
    const ids = Array.from({ length: BULK_REJECT_MAX_IDS + 1 }, (_, i) => `id-${i}`);
    expect(validateBulkRejectIdCount(ids)).toContain("100");
  });

  it("accepts up to max ids", () => {
    const ids = Array.from({ length: BULK_REJECT_MAX_IDS }, (_, i) => `id-${i}`);
    expect(validateBulkRejectIdCount(ids)).toBeNull();
  });
});
