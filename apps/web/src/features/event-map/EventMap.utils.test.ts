import { describe, expect, it, vi } from "vitest";

import type { EventListItem } from "@fresno-events/shared";

import { filterEventsForMap, groupEventsByVenue } from "./EventMap.utils";

function item(
  id: string,
  venueId: string,
  opts?: { lat?: number; lng?: number; priority?: number; startTs?: string }
): EventListItem {
  return {
    event: {
      id,
      slug: id,
      source: "manual",
      sourceRefs: {},
      title: `Event ${id}`,
      venueId,
      startTs: opts?.startTs ?? "2026-07-19T02:00:00.000Z",
      timezone: "America/Los_Angeles",
      category: "music",
      subcategories: [],
      tags: [],
      currency: "USD",
      status: "scheduled",
      galleryImageIds: [],
      allArtistIds: [],
      priority: opts?.priority ?? 5,
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z"
    },
    venue: {
      id: venueId,
      slug: venueId,
      name: "Venue",
      city: "Fresno",
      socials: {},
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
      ...(opts?.lat != null ? { lat: opts.lat } : {}),
      ...(opts?.lng != null ? { lng: opts.lng } : {})
    }
  };
}

describe("groupEventsByVenue", () => {
  it("groups events at the same venue with coordinates", () => {
    const groups = groupEventsByVenue([
      item("a", "v1", { lat: 36.7, lng: -119.8 }),
      item("b", "v1", { lat: 36.7, lng: -119.8 }),
      item("c", "v2", { lat: 36.8, lng: -119.7 })
    ]);
    expect(groups).toHaveLength(2);
    expect(groups.find((group) => group.venueId === "v1")?.events).toHaveLength(2);
  });

  it("skips venues without coordinates", () => {
    const groups = groupEventsByVenue([item("a", "v1")]);
    expect(groups).toHaveLength(0);
  });
});

describe("filterEventsForMap", () => {
  it("defaults to this week and sorts by priority then start", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-18T20:00:00.000Z"));

    const sorted = filterEventsForMap(
      [
        item("late-p5", "v1", { priority: 5, startTs: "2026-07-19T04:00:00.000Z" }),
        item("early-p2", "v1", { priority: 2, startTs: "2026-07-20T04:00:00.000Z" }),
        item("earlier-p2", "v1", { priority: 2, startTs: "2026-07-19T02:00:00.000Z" }),
        item("far", "v1", { priority: 1, startTs: "2026-08-01T02:00:00.000Z" })
      ],
      { datePreset: "week" }
    );

    expect(sorted.map((row) => row.event.id)).toEqual(["earlier-p2", "early-p2", "late-p5"]);
    vi.useRealTimers();
  });
});
