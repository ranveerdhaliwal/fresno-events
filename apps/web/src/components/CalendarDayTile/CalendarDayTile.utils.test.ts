import { describe, expect, it } from "vitest";
import type { EventListItem } from "@fresno-events/shared";

import {
  collapseCalendarPreview,
  isPacificWeekend,
  pacificDowShort
} from "./CalendarDayTile.utils";

describe("pacificDowShort", () => {
  it("returns SUN for a known Sunday", () => {
    expect(pacificDowShort("2026-06-07")).toBe("SUN");
  });

  it("returns WED for a known Wednesday", () => {
    expect(pacificDowShort("2026-06-10")).toBe("WED");
  });
});

describe("isPacificWeekend", () => {
  it("detects Saturday and Sunday", () => {
    expect(isPacificWeekend("2026-06-07")).toBe(true);
    expect(isPacificWeekend("2026-06-06")).toBe(true);
    expect(isPacificWeekend("2026-06-10")).toBe(false);
  });
});

function stubItem(id: string, title: string, cdnUrl?: string): EventListItem {
  return {
    event: {
      id,
      slug: id,
      title,
      category: "music",
      tags: [],
      subcategories: [],
      status: "published",
      startTs: "2026-08-15T20:00:00.000Z",
      venueId: "v1",
      timezone: "America/Los_Angeles",
      source: "manual",
      sourceRefs: {},
      currency: "USD",
      galleryImageIds: [],
      allArtistIds: [],
      priority: 3,
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z"
    },
    venue: {
      id: "v1",
      slug: "venue",
      name: "Venue",
      city: "Fresno",
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z"
    },
    ...(cdnUrl
      ? {
          heroImage: {
            id: `img-${id}`,
            storageKey: `mock/${id}`,
            cdnUrl,
            width: 100,
            height: 100,
            createdAt: "2026-01-01T00:00:00.000Z"
          }
        }
      : {})
  } as unknown as EventListItem;
}

describe("collapseCalendarPreview", () => {
  it("collapses same-name occurrences into one row with a count", () => {
    const rows = collapseCalendarPreview([
      stubItem("a", "Jason Aldean, Chase Matthew", "https://cdn.example.com/a.jpg"),
      stubItem("b", "Jason Aldean, Chase Matthew"),
      stubItem("c", "Jason Aldean, Chase Matthew"),
      stubItem("d", "ZZ Top")
    ]);

    expect(rows).toHaveLength(2);
    expect(rows[0]?.title).toBe("Jason Aldean, Chase Matthew");
    expect(rows[0]?.occurrenceCount).toBe(3);
    expect(rows[0]?.thumbUrl).toBe("https://cdn.example.com/a.jpg");
    expect(rows[1]?.title).toBe("ZZ Top");
    expect(rows[1]?.occurrenceCount).toBe(1);
  });
});
