import { describe, expect, it } from "vitest";

import { formatIngestExclusionNotes, getIngestExclusion } from "./ingest-exclusions.js";

describe("ingest-exclusions", () => {
  it("rejects Shen Yun by title", () => {
    const result = getIngestExclusion({ title: "Shen Yun" });
    expect(result?.id).toBe("shen-yun");
    expect(formatIngestExclusionNotes(result!)).toContain("excluded");
  });

  it("rejects Shen Yun when mentioned in description", () => {
    expect(getIngestExclusion({ title: "Evening Performance", descriptionText: "Presented by Shen Yun" })?.id).toBe(
      "shen-yun"
    );
  });

  it("allows unrelated events", () => {
    expect(getIngestExclusion({ title: "Mrs. Doubtfire" })).toBeNull();
  });
});
