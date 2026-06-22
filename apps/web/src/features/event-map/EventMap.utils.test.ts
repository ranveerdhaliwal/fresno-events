import { describe, expect, it } from "vitest";

import type { EventListItem } from "@fresno-events/shared";

import { groupEventsByVenue } from "./EventMap.utils";

function item(id: string, venueId: string, lat?: number, lng?: number): EventListItem {
  return {
    event: {
      id,
      slug: id,
      source: "manual",
      sourceRefs: {},
      title: `Event ${id}`,
      venueId,
      startTs: "2026-07-01T02:00:00.000Z",
      timezone: "America/Los_Angeles",
      category: "music",
      subcategories: [],
      tags: [],
      currency: "USD",
      status: "scheduled",
      galleryImageIds: [],
      allArtistIds: [],
      priority: 5,
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
      ...(lat != null ? { lat } : {}),
      ...(lng != null ? { lng } : {})
    }
  };
}

describe("groupEventsByVenue", () => {
  it("groups events at the same venue with coordinates", () => {
    const groups = groupEventsByVenue([
      item("a", "v1", 36.7, -119.8),
      item("b", "v1", 36.7, -119.8),
      item("c", "v2", 36.8, -119.7)
    ]);
    expect(groups).toHaveLength(2);
    expect(groups.find((group) => group.venueId === "v1")?.events).toHaveLength(2);
  });

  it("skips venues without coordinates", () => {
    const groups = groupEventsByVenue([item("a", "v1")]);
    expect(groups).toHaveLength(0);
  });
});
