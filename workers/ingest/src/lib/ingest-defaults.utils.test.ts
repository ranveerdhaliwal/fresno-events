import { describe, expect, it } from "vitest";

import { applyIngestDefaults } from "./ingest-defaults.utils";

const base = {
  source: "api:visitfresnocounty" as const,
  sourceEventId: "1:2026-06-01",
  title: "Sample",
  venueName: "Venue",
  startTs: "2026-06-01T16:00:00.000Z"
};

describe("applyIngestDefaults", () => {
  it("does not invent an end time when the source omitted one", () => {
    const result = applyIngestDefaults(base);
    expect(result.endTs).toBeUndefined();
  });

  it("keeps an explicit end time from the source", () => {
    const result = applyIngestDefaults({
      ...base,
      endTs: "2026-06-01T19:00:00.000Z"
    });
    expect(result.endTs).toBe("2026-06-01T19:00:00.000Z");
  });

  it("does not invent an end time when the source marked timeUnknown", () => {
    const result = applyIngestDefaults({ ...base, timeUnknown: true });
    expect(result.endTs).toBeUndefined();
  });

  it("keeps an explicit end time for timeUnknown listings", () => {
    const result = applyIngestDefaults({
      ...base,
      timeUnknown: true,
      endTs: "2026-06-01T19:00:00.000Z"
    });
    expect(result.endTs).toBe("2026-06-01T19:00:00.000Z");
  });

  it("fills known venue address and coords before persist", () => {
    const result = applyIngestDefaults({
      ...base,
      venueName: "Rainbow Ballroom"
    });
    expect(result.venueAddress).toBe("1725 Broadway St");
    expect(result.venueLat).toBe(36.7402635);
    expect(result.venueLng).toBe(-119.7994878);
  });

  it("rounds fractional display prices up to whole dollars", () => {
    const result = applyIngestDefaults({
      ...base,
      priceMin: 31.83,
      priceMax: 34.92
    });
    expect(result.priceMin).toBe(32);
    expect(result.priceMax).toBe(35);
  });

  it("strips api tag before persist", () => {
    const result = applyIngestDefaults({
      ...base,
      tags: ["api", "live", "API"]
    });
    expect(result.tags).toEqual(["live"]);
  });
});
