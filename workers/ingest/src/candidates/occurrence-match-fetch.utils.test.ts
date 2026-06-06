import { describe, expect, it } from "vitest";

import {
  chunkValues,
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
