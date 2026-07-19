import { describe, expect, it } from "vitest";

import type { EventListItem } from "@fresno-events/shared";

import {
  filterOutBeforePacificToday,
  filterOutPastItems,
  filterItemsOnPacificDate,
  partitionEndedPreview,
  splitTodayItems
} from "./active-ended-events.utils";

function item(partial: {
  id: string;
  startTs: string;
  endTs?: string;
  priority?: number;
}): EventListItem {
  return {
    event: {
      id: partial.id,
      slug: partial.id,
      source: "ticketmaster",
      sourceRefs: {},
      title: partial.id,
      venueId: "v1",
      startTs: partial.startTs,
      ...(partial.endTs ? { endTs: partial.endTs } : {}),
      timezone: "America/Los_Angeles",
      category: "music",
      subcategories: [],
      tags: [],
      currency: "USD",
      status: "scheduled",
      galleryImageIds: [],
      allArtistIds: [],
      priority: partial.priority ?? 3,
      createdAt: partial.startTs,
      updatedAt: partial.startTs
    },
    venue: {
      id: "v1",
      slug: "v1",
      name: "Venue",
      city: "Fresno",
      createdAt: partial.startTs,
      updatedAt: partial.startTs
    }
  };
}

describe("active-ended-events.utils", () => {
  const now = new Date("2026-07-18T20:00:00-07:00");

  it("keeps only Pacific calendar-day matches", () => {
    const items = [
      item({ id: "a", startTs: "2026-07-18T19:00:00-07:00" }),
      item({ id: "b", startTs: "2026-07-17T19:00:00-07:00" })
    ];
    expect(filterItemsOnPacificDate(items, "2026-07-18").map((i) => i.event.id)).toEqual(["a"]);
  });

  it("hides days before Pacific today", () => {
    const items = [
      item({ id: "yesterday", startTs: "2026-07-17T19:00:00-07:00" }),
      item({ id: "today", startTs: "2026-07-18T19:00:00-07:00" }),
      item({ id: "tomorrow", startTs: "2026-07-19T19:00:00-07:00" })
    ];
    expect(filterOutBeforePacificToday(items, now).map((i) => i.event.id)).toEqual(["today", "tomorrow"]);
  });

  it("drops past items", () => {
    const items = [
      item({ id: "ended", startTs: "2026-07-18T10:00:00-07:00", endTs: "2026-07-18T12:00:00-07:00" }),
      item({ id: "later", startTs: "2026-07-19T19:00:00-07:00" })
    ];
    expect(filterOutPastItems(items, now).map((i) => i.event.id)).toEqual(["later"]);
  });

  it("splits today into active vs ended and previews biggest ended", () => {
    const items = [
      item({ id: "p5", startTs: "2026-07-18T10:00:00-07:00", endTs: "2026-07-18T11:00:00-07:00", priority: 5 }),
      item({ id: "p1", startTs: "2026-07-18T12:00:00-07:00", endTs: "2026-07-18T13:00:00-07:00", priority: 1 }),
      item({ id: "p2", startTs: "2026-07-18T14:00:00-07:00", endTs: "2026-07-18T15:00:00-07:00", priority: 2 }),
      item({ id: "p3", startTs: "2026-07-18T16:00:00-07:00", endTs: "2026-07-18T17:00:00-07:00", priority: 3 }),
      item({ id: "live", startTs: "2026-07-18T19:00:00-07:00", endTs: "2026-07-18T22:00:00-07:00", priority: 2 })
    ];
    const { active, ended } = splitTodayItems(items, now);
    expect(active.map((i) => i.event.id)).toEqual(["live"]);
    expect(ended.map((i) => i.event.id)).toEqual(["p1", "p2", "p3", "p5"]);
    const { preview, rest } = partitionEndedPreview(ended, 3);
    expect(preview.map((i) => i.event.id)).toEqual(["p1", "p2", "p3"]);
    expect(rest.map((i) => i.event.id)).toEqual(["p5"]);
  });
});
