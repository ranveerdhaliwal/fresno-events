import { describe, expect, it } from "vitest";

import { sanitizeEventTags } from "./event-tags.utils";

describe("sanitizeEventTags", () => {
  it("strips api (any case) and dedupes", () => {
    expect(sanitizeEventTags(["API", "live", "api", "Rock", "live"])).toEqual(["live", "Rock"]);
  });

  it("returns empty for nullish or empty", () => {
    expect(sanitizeEventTags(null)).toEqual([]);
    expect(sanitizeEventTags(undefined)).toEqual([]);
    expect(sanitizeEventTags([])).toEqual([]);
  });
});
