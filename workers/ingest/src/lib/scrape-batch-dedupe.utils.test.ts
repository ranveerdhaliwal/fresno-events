import { describe, expect, it } from "vitest";

import { dedupeScrapeBatch } from "@/lib/scrape-batch-dedupe.utils";

describe("dedupeScrapeBatch", () => {
  it("collapses title drift duplicates at the same time and venue", async () => {
    const base = {
      source: "api:visitfresnocounty" as const,
      venueName: "The Backyard Social Club",
      venueCity: "Clovis",
      startTs: "2026-06-03T02:00:00.000Z",
      category: "community" as const
    };

    const result = await dedupeScrapeBatch([
      {
        ...base,
        sourceEventId: "aaa",
        title: "Backyard 101 - Trivia",
        seriesName: "Recurring weekly on Tuesday",
        externalUrl: "https://example.com/backyard-101"
      },
      {
        ...base,
        sourceEventId: "bbb",
        title: "Backyard101 - Trivia"
      }
    ]);

    expect(result.events).toHaveLength(1);
    expect(result.removed).toBe(1);
    expect(result.duplicates[0]?.match).toBe("loose_title");
    expect(result.duplicates[0]?.kept_external_url).toBe("https://example.com/backyard-101");
    expect(result.events[0]?.sourceEventId).toBe("aaa");
  });

  it("keeps same URL on different dates (recurring series)", async () => {
    const url = "https://www.visitfresnocounty.org/event/fresno-scavenger-hunt/123/";
    const result = await dedupeScrapeBatch([
      {
        source: "api:visitfresnocounty",
        sourceEventId: "day-1",
        title: "Fresno Scavenger Hunt",
        venueName: "Downtown Fresno",
        startTs: "2026-06-02T15:00:00.000Z",
        externalUrl: url
      },
      {
        source: "api:visitfresnocounty",
        sourceEventId: "day-2",
        title: "Fresno Scavenger Hunt",
        venueName: "Downtown Fresno",
        startTs: "2026-06-03T15:00:00.000Z",
        externalUrl: url
      }
    ]);

    expect(result.events).toHaveLength(2);
    expect(result.removed).toBe(0);
  });

  it("prefers Presented By listing over multi-year master for same night", async () => {
    const base = {
      source: "api:visitfresnocounty" as const,
      venueName: "River Park Farmer's Market",
      venueCity: "Fresno",
      startTs: "2026-06-09T19:00:00.000Z",
      seriesName: "Recurring weekly on Tuesday"
    };

    const result = await dedupeScrapeBatch([
      {
        ...base,
        sourceEventId: "master",
        title: "River Park Farmer's Market",
        externalUrl: "https://www.visitfresnocounty.org/event/river-park-farmers-market/1145/",
        seriesListingRecId: "1145"
      },
      {
        ...base,
        sourceEventId: "occurrence",
        title: "River Park Farmers Market",
        externalUrl: "https://www.visitfresnocounty.org/event/river-park-farmers-market/4975/",
        seriesListingRecId: "4975",
        seriesPresentedBy: "River Park Farmer's Market"
      }
    ]);

    expect(result.events).toHaveLength(1);
    expect(result.removed).toBe(1);
    expect(result.events[0]?.sourceEventId).toBe("occurrence");
    expect(result.events[0]?.externalUrl).toContain("/4975/");
  });

  it("collapses farmers market title spelling at the same time", async () => {
    const base = {
      source: "api:visitfresnocounty" as const,
      venueName: "River Park Shopping Center",
      startTs: "2026-06-02T19:00:00.000Z"
    };

    const result = await dedupeScrapeBatch([
      {
        ...base,
        sourceEventId: "a",
        title: "River Park Farmer's Market"
      },
      {
        ...base,
        sourceEventId: "b",
        title: "River Park Farmers Market"
      }
    ]);

    expect(result.events).toHaveLength(1);
    expect(result.removed).toBe(1);
    expect(result.duplicates[0]?.match).toBe("loose_title");
  });
});
