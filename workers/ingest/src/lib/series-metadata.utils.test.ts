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

  it("assigns seriesId when multiple nights share listing recid", async () => {
    const base = {
      source: "api:visitfresnocounty" as const,
      title: "Miss California Competition Week",
      venueName: "William Saroyan Theatre",
      seriesListingRecId: "9109"
    };
    const results = await applySeriesMetadata([
      { ...base, sourceEventId: "a", startTs: "2026-06-17T02:00:00.000Z" },
      { ...base, sourceEventId: "b", startTs: "2026-06-18T02:00:00.000Z" }
    ]);
    expect(results[0]?.seriesId).toBeDefined();
    expect(results[0]?.seriesId).toBe(results[1]?.seriesId);
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
