import { describe, expect, it } from "vitest";

import type { EventListItem } from "@fresno-events/shared";

import { dedupeEventItems, dedupeFeaturedItems, featuredDedupeKey } from "./featured-dedupe.utils";

function makeItem(overrides: {
  id: string;
  title: string;
  venueName: string;
  startTs: string;
  category?: string;
  seriesId?: string;
}): EventListItem {
  return {
    event: {
      id: overrides.id,
      title: overrides.title,
      startTs: overrides.startTs,
      category: overrides.category ?? "music",
      ...(overrides.seriesId ? { seriesId: overrides.seriesId } : {})
    },
    venue: {
      name: overrides.venueName
    }
  } as unknown as EventListItem;
}

const ringlingA = makeItem({
  id: "evt-a",
  title: "Ringling Bros. And Barnum & Bailey",
  venueName: "Save Mart Center",
  startTs: "2026-07-05T13:00:00.000-07:00"
});

const ringlingB = makeItem({
  id: "evt-b",
  title: "  Ringling Bros.  And Barnum & Bailey ",
  venueName: "Save Mart Center",
  startTs: "2026-07-05T13:00:00.000-07:00"
});

const otherEvent = makeItem({
  id: "evt-c",
  title: "Garden Brothers Circus",
  venueName: "Fresno Fairgrounds",
  startTs: "2026-07-05T19:00:00.000-07:00"
});

const quakesA = makeItem({
  id: "evt-q1",
  title: "Fresno Grizzlies vs Rancho Cucamonga Quakes",
  venueName: "Chukchansi Park",
  startTs: "2026-07-21T18:50:00.000-07:00",
  category: "sports"
});

const quakesB = makeItem({
  id: "evt-q2",
  title: "Fresno Grizzlies vs Rancho Cucamonga Quakes",
  venueName: "Chukchansi Park",
  startTs: "2026-07-22T18:50:00.000-07:00",
  category: "sports"
});

const awayGame = makeItem({
  id: "evt-away",
  title: "Fresno Grizzlies at Visalia Rawhide",
  venueName: "Visalia",
  startTs: "2026-07-19T18:00:00.000-07:00",
  category: "sports"
});

const comedy = makeItem({
  id: "evt-comedy",
  title: "Nate Bargatze",
  venueName: "Save Mart Center",
  startTs: "2026-07-19T20:00:00.000-07:00",
  category: "comedy"
});

describe("featuredDedupeKey", () => {
  it("normalizes title whitespace and case so duplicates collide", () => {
    expect(featuredDedupeKey(ringlingA)).toBe(featuredDedupeKey(ringlingB));
  });

  it("keeps genuinely different events distinct", () => {
    expect(featuredDedupeKey(ringlingA)).not.toBe(featuredDedupeKey(otherEvent));
  });
});

describe("dedupeFeaturedItems", () => {
  it("drops duplicate slots by content signature, keeping the first", () => {
    const slots = [
      { source: "auto" as const, item: ringlingA },
      { source: "auto" as const, item: ringlingB },
      { source: "auto" as const, item: otherEvent }
    ];

    const result = dedupeFeaturedItems(slots);

    expect(result).toHaveLength(2);
    expect(result[0]?.item.event.id).toBe("evt-a");
    expect(result[1]?.item.event.id).toBe("evt-c");
  });

  it("keeps at most one sports event in featured", () => {
    const slots = [
      { source: "auto" as const, item: comedy },
      { source: "auto" as const, item: awayGame },
      { source: "auto" as const, item: quakesA },
      { source: "auto" as const, item: quakesB }
    ];
    const result = dedupeFeaturedItems(slots);
    expect(result.map((slot) => slot.item.event.id)).toEqual(["evt-comedy", "evt-away"]);
  });

  it("returns the same list when there are no duplicates", () => {
    const slots = [
      { source: "auto" as const, item: ringlingA },
      { source: "auto" as const, item: otherEvent }
    ];
    expect(dedupeFeaturedItems(slots)).toHaveLength(2);
  });
});

describe("dedupeEventItems", () => {
  it("dedupes a flat event list by content", () => {
    const result = dedupeEventItems([ringlingA, ringlingB, otherEvent]);
    expect(result.map((item) => item.event.id)).toEqual(["evt-a", "evt-c"]);
  });

  it("collapses multi-night runs of the same game", () => {
    const result = dedupeEventItems([quakesA, quakesB, comedy]);
    expect(result.map((item) => item.event.id)).toEqual(["evt-q1", "evt-comedy"]);
  });
});
