import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { EventListItem } from "@fresno-events/shared";

import { renderWithSiteRouter } from "@/tests/router-render";
import { screen } from "@/tests/render";

import { ActiveEndedEventList } from "./ActiveEndedEventList";

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

describe("ActiveEndedEventList", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-18T20:00:00-07:00"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("shows show-more-ended when more than preview ended exist", async () => {
    const items = [
      item({ id: "p1", startTs: "2026-07-18T10:00:00-07:00", endTs: "2026-07-18T11:00:00-07:00", priority: 1 }),
      item({ id: "p2", startTs: "2026-07-18T12:00:00-07:00", endTs: "2026-07-18T13:00:00-07:00", priority: 2 }),
      item({ id: "p3", startTs: "2026-07-18T14:00:00-07:00", endTs: "2026-07-18T15:00:00-07:00", priority: 3 }),
      item({ id: "p4", startTs: "2026-07-18T16:00:00-07:00", endTs: "2026-07-18T17:00:00-07:00", priority: 4 })
    ];

    await renderWithSiteRouter(
      <ActiveEndedEventList items={items} dayIso="2026-07-18" linkRows />
    );

    expect(screen.getByTestId("active-ended-event-list")).toBeInTheDocument();
    expect(screen.getByTestId("show-more-ended")).toBeInTheDocument();
  });
});
