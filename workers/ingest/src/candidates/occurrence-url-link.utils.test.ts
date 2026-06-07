import { describe, expect, it } from "vitest";

import {
  occurrenceLookupKeysOverlap,
  urlKeyLinksWithOccurrenceLookup
} from "@/candidates/occurrence-url-link.utils";

describe("occurrence-url-link.utils", () => {
  it("detects overlapping Pacific bucket lookup keys", () => {
    const left = { occurrenceKeysForLookup: ["a", "b", "c"] };
    const right = { occurrenceKeysForLookup: ["c", "d"] };
    expect(occurrenceLookupKeysOverlap(left, right)).toBe(true);
    expect(occurrenceLookupKeysOverlap(left, { occurrenceKeysForLookup: ["x"] })).toBe(false);
  });

  it("requires occurrence bucket overlap for url_key linking", () => {
    const fingerprints = { occurrenceKeysForLookup: ["night-one", "night-one-adj"] };
    expect(urlKeyLinksWithOccurrenceLookup(fingerprints, "night-one")).toBe(true);
    expect(urlKeyLinksWithOccurrenceLookup(fingerprints, "night-two")).toBe(false);
  });
});
