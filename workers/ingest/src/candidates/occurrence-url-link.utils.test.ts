import { describe, expect, it } from "vitest";

import {
  occurrenceLookupKeysOverlap,
  urlKeyLinksAcrossSources,
  urlKeyLinksWithOccurrenceLookup
} from "@/candidates/occurrence-url-link.utils";

describe("occurrence-url-link.utils", () => {
  it("detects overlapping Pacific bucket lookup keys", () => {
    const left = { occurrenceKeysForLookup: ["a", "b", "c"] };
    const right = { occurrenceKeysForLookup: ["c", "d"] };
    expect(occurrenceLookupKeysOverlap(left, right)).toBe(true);
    expect(occurrenceLookupKeysOverlap(left, { occurrenceKeysForLookup: ["x"] })).toBe(false);
  });

  it("requires occurrence bucket overlap for generic shared series urls", () => {
    const fingerprints = { occurrenceKeysForLookup: ["night-one", "night-one-adj"] };
    expect(urlKeyLinksWithOccurrenceLookup(fingerprints, "night-one")).toBe(true);
    expect(urlKeyLinksWithOccurrenceLookup(fingerprints, "night-two")).toBe(false);
  });

  it("links unique ticketmaster listings across Pacific bucket drift", () => {
    const fingerprints = { occurrenceKeysForLookup: ["night-one"] };
    const listingUrls = {
      ticketUrl:
        "https://www.ticketmaster.com/nate-bargatze-big-dumb-eyes-world-fresno-california-07-19-2026/event/1C00631A8DE414D4"
    };
    expect(urlKeyLinksAcrossSources(fingerprints, "night-two", listingUrls)).toBe(true);
  });
});
