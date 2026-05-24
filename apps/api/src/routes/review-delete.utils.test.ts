import { describe, expect, it } from "vitest";

import { partitionCandidatesForDelete } from "./review-delete.utils";

describe("partitionCandidatesForDelete", () => {
  it("deletes pending rows and skips approved without force", () => {
    const result = partitionCandidatesForDelete(
      ["a", "b", "c"],
      [
        { id: "a", status: "pending_review" },
        { id: "b", status: "approved" }
      ],
      false
    );
    expect(result.toDelete).toEqual(["a"]);
    expect(result.skipped).toEqual([
      { id: "b", reason: "approved" },
      { id: "c", reason: "not_found" }
    ]);
  });

  it("deletes approved rows when force is true", () => {
    const result = partitionCandidatesForDelete(["b"], [{ id: "b", status: "approved" }], true);
    expect(result.toDelete).toEqual(["b"]);
    expect(result.skipped).toEqual([]);
  });
});
