import { describe, expect, it } from "vitest";

import { applySeriesMetadata } from "./series-metadata.utils.js";

describe("applySeriesMetadata", () => {
  it("assigns canonical seriesId from recurrence label", async () => {
    const [result] = await applySeriesMetadata([
      {
        source: "api:visitfresnocounty",
        sourceEventId: "occ-1",
        title: "Backyard 101 - Trivia",
        venueName: "The Backyard Social Club",
        startTs: "2026-06-03T02:00:00.000Z",
        seriesName: "Recurring weekly on Tuesday"
      }
    ]);

    expect(result?.seriesId).toMatch(/^series:visitfresnocounty:[a-f0-9]{64}$/);
  });

  it("preserves explicit seriesId from venue config", async () => {
    const [result] = await applySeriesMetadata([
      {
        source: "scrape:fair.com",
        sourceEventId: "day-1",
        title: "Fair Day 1",
        venueName: "Fairgrounds",
        startTs: "2026-10-01T18:00:00.000Z",
        seriesId: "series:bigfresnofair:2026"
      }
    ]);

    expect(result?.seriesId).toBe("series:bigfresnofair:2026");
  });

  it("leaves one-offs without seriesId", async () => {
    const [result] = await applySeriesMetadata([
      {
        source: "api:milb",
        sourceEventId: "game-1",
        title: "Grizzlies vs Rawhide",
        venueName: "Chukchansi Park",
        startTs: "2026-06-01T02:00:00.000Z"
      }
    ]);

    expect(result?.seriesId).toBeUndefined();
  });
});
