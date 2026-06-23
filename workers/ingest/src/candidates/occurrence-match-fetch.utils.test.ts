import { describe, expect, it } from "vitest";

import {
  capInFilterBatches,
  capStartTsWindows,
  chunkValues,
  collectOccurrenceKeysForFetch,
  compressStartTsWindowsForFetch,
  dedupeStartTsWindows,
  mergeOverlappingStartTsWindows,
  MAX_START_TS_WINDOW_FETCHES,
  OCCURRENCE_IN_FILTER_BATCH_SIZE
} from "./occurrence-match-fetch.utils";

describe("chunkValues", () => {
  it("splits keys into bounded batches for PostgREST in filters", () => {
    const keys = Array.from({ length: 100 }, (_, i) => `k${i}`);
    const chunks = chunkValues(keys, OCCURRENCE_IN_FILTER_BATCH_SIZE);
    expect(chunks).toHaveLength(3);
    expect(chunks[0]).toHaveLength(48);
    expect(chunks[1]).toHaveLength(48);
    expect(chunks[2]).toHaveLength(4);
  });

  it("returns empty for empty input", () => {
    expect(chunkValues([], 48)).toEqual([]);
  });
});

describe("dedupeStartTsWindows", () => {
  it("removes exact duplicate windows", () => {
    const window = { from: "2026-06-01T00:00:00.000Z", to: "2026-06-02T00:00:00.000Z" };
    expect(dedupeStartTsWindows([window, window, window])).toEqual([window]);
  });
});

describe("mergeOverlappingStartTsWindows", () => {
  it("merges overlapping ±36h windows into one range", () => {
    const windows = [
      { from: "2026-06-01T00:00:00.000Z", to: "2026-06-03T00:00:00.000Z" },
      { from: "2026-06-02T12:00:00.000Z", to: "2026-06-04T00:00:00.000Z" },
      { from: "2026-06-10T00:00:00.000Z", to: "2026-06-12T00:00:00.000Z" }
    ];

    expect(mergeOverlappingStartTsWindows(windows)).toEqual([
      { from: "2026-06-01T00:00:00.000Z", to: "2026-06-04T00:00:00.000Z" },
      { from: "2026-06-10T00:00:00.000Z", to: "2026-06-12T00:00:00.000Z" }
    ]);
  });
});

describe("capStartTsWindows", () => {
  it("coalesces many disjoint windows into a fixed number of coarse spans", () => {
    const windows = Array.from({ length: 12 }, (_, i) => ({
      from: new Date(Date.UTC(2026, 5, 1 + i * 7)).toISOString(),
      to: new Date(Date.UTC(2026, 5, 3 + i * 7)).toISOString()
    }));

    expect(capStartTsWindows(windows, 3)).toHaveLength(3);
  });
});

describe("capInFilterBatches", () => {
  it("limits the number of PostgREST in batches", () => {
    const values = Array.from({ length: 200 }, (_, i) => `k${i}`);
    expect(capInFilterBatches(values, 48, 3)).toHaveLength(3);
    expect(capInFilterBatches(values, 48, 3)[0]).toHaveLength(48);
  });
});

describe("collectOccurrenceKeysForFetch", () => {
  it("uses only the primary occurrence key in compact mode", () => {
    const fingerprints = {
      occurrenceKey: "primary-key",
      occurrenceKeysForLookup: ["primary-key", "alt-key-1", "alt-key-2"]
    };

    expect(collectOccurrenceKeysForFetch(fingerprints, true)).toEqual(["primary-key"]);
    expect(collectOccurrenceKeysForFetch(fingerprints, false)).toEqual([
      "primary-key",
      "alt-key-1",
      "alt-key-2"
    ]);
  });
});

describe("compressStartTsWindowsForFetch", () => {
  it("caps a large per-event window list to the subrequest budget", () => {
    const windows = Array.from({ length: 209 }, (_, i) => {
      const start = new Date(Date.UTC(2026, 5, 1 + i)).toISOString();
      return {
        from: new Date(new Date(start).getTime() - 36 * 60 * 60 * 1000).toISOString(),
        to: new Date(new Date(start).getTime() + 36 * 60 * 60 * 1000).toISOString()
      };
    });

    const compressed = compressStartTsWindowsForFetch(windows);
    expect(compressed.length).toBeLessThanOrEqual(MAX_START_TS_WINDOW_FETCHES);
    expect(compressed.length).toBeGreaterThan(0);
  });
});
