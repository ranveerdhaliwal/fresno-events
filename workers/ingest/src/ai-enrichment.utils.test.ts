import { describe, expect, it } from "vitest";

import { clampSuggestedPriority } from "./ai-enrichment.utils";

describe("clampSuggestedPriority", () => {
  it("defaults invalid values to 5", () => {
    expect(clampSuggestedPriority(undefined, false)).toBe(5);
    expect(clampSuggestedPriority("x", false)).toBe(5);
  });

  it("coerces 0 to 5 for non-junk organic events", () => {
    expect(clampSuggestedPriority(0, false)).toBe(5);
  });

  it("allows 0 for junk", () => {
    expect(clampSuggestedPriority(0, true)).toBe(0);
  });

  it("clamps in-range values", () => {
    expect(clampSuggestedPriority(1, false)).toBe(1);
    expect(clampSuggestedPriority(9, false)).toBe(5);
  });
});
