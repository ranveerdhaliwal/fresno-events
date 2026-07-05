import { describe, expect, it } from "vitest";

import type { EventListItem } from "@fresno-events/shared";

import { dedupeEventItems, dedupeFeaturedItems, featuredDedupeKey } from "./featured-dedupe.utils";

function makeItem(overrides: {
  id: string;
  title: string;
  venueName: string;
  startTs: string;
}): EventListItem {
  return {
    event: {
      id: overrides.id,
      title: overrides.title,
      startTs: overrides.startTs
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

  it("returns the same list when there are no duplicates", () => {
    const slots = [
      { source: "auto" as const, item: ringlingA },
      { source: "auto" as const, item: otherEvent }
    ];
    expect(dedupeFeaturedItems(slots)).toHaveLength(2);
  });
});

describe("dedupeEventItems", () => {
  it("dedupes a flat event list", () => {
    const result = dedupeEventItems([ringlingA, ringlingB, otherEvent]);
    expect(result.map((item) => item.event.id)).toEqual(["evt-a", "evt-c"]);
  });
});
