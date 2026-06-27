import { describe, expect, it } from "vitest";

import {
  capOccurrenceIdsForPriceHarmonize,
  MAX_PRICE_HARMONIZE_OCCURRENCES_COMPACT,
  shouldSkipPublishedEventSync,
  useCompactPersistBudget
} from "./candidates-persist-budget.utils";
import { COMPACT_OCCURRENCE_FETCH_EVENT_THRESHOLD } from "./occurrence-match-fetch.utils";

describe("useCompactPersistBudget", () => {
  it("is false below the compact threshold", () => {
    expect(useCompactPersistBudget(COMPACT_OCCURRENCE_FETCH_EVENT_THRESHOLD - 1)).toBe(false);
  });

  it("is true at and above the compact threshold", () => {
    expect(useCompactPersistBudget(COMPACT_OCCURRENCE_FETCH_EVENT_THRESHOLD)).toBe(true);
    expect(useCompactPersistBudget(209)).toBe(true);
  });
});

describe("shouldSkipPublishedEventSync", () => {
  it("matches compact persist budget", () => {
    expect(shouldSkipPublishedEventSync(39)).toBe(false);
    expect(shouldSkipPublishedEventSync(40)).toBe(true);
  });
});

describe("capOccurrenceIdsForPriceHarmonize", () => {
  const ids = Array.from({ length: 12 }, (_, i) => `occ-${i}`);

  it("returns all ids when under compact threshold", () => {
    expect(capOccurrenceIdsForPriceHarmonize(10, ids)).toEqual(ids);
  });

  it("caps ids in compact mode", () => {
    expect(capOccurrenceIdsForPriceHarmonize(50, ids)).toHaveLength(
      MAX_PRICE_HARMONIZE_OCCURRENCES_COMPACT
    );
    expect(capOccurrenceIdsForPriceHarmonize(50, ids)).toEqual(ids.slice(0, MAX_PRICE_HARMONIZE_OCCURRENCES_COMPACT));
  });

  it("does not mutate the input array", () => {
    const input = ["a", "b", "c"];
    capOccurrenceIdsForPriceHarmonize(50, input);
    expect(input).toEqual(["a", "b", "c"]);
  });
});
