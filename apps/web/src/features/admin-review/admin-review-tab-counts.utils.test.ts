import { describe, expect, it } from "vitest";

import { formatReviewTabLabel, tabCountForReviewTab } from "./admin-review-tab-counts.utils";

const counts = {
  pending_review: 279,
  needs_changes: 187,
  approved: 42,
  rejected: 5
};

describe("admin-review-tab-counts.utils", () => {
  it("maps review tabs to count fields", () => {
    expect(tabCountForReviewTab("new", counts)).toBe(279);
    expect(tabCountForReviewTab("updates", counts)).toBe(187);
    expect(tabCountForReviewTab("approved", counts)).toBe(42);
    expect(tabCountForReviewTab("rejected", counts)).toBe(5);
  });

  it("formats tab labels with counts", () => {
    expect(formatReviewTabLabel("New", 279)).toBe("New (279)");
    expect(formatReviewTabLabel("Updates", undefined)).toBe("Updates");
  });
});
