import { describe, expect, it } from "vitest";

import type { VenuniteEvent } from "./venunite.types";
import {
  mapVenuniteCategory,
  mapVenuniteEvents,
  resolveSourceEventId,
  shouldSkipModule,
  shouldSkipVenue
} from "./venunite.utils";

const baseEvent: VenuniteEvent = {
  id: 1919350,
  title: "BarrelHouse Anniversary Party",
  slug: "barrelhouse-anniversary-party",
  startDate: "2026-06-06T23:00:00.000Z",
  endDate: "2026-06-07T06:00:00.000Z",
  timezone: "America/Los_Angeles",
  cost: "Free",
  source: "scraper:eventbrite_ca",
  sourceModule: "eventbrite_ca",
  website: "https://www.eventbrite.com/e/barrelhouse-anniversary-party-tickets-1990516589703",
  venue: { name: "BarrelHouse Brewing Fresno - Taproom", city: "Fresno", state: "CA" },
  categories: ["Nightlife"],
  category: "community"
};

describe("venunite.utils", () => {
  it("skips overlapping sourceModules", () => {
    expect(shouldSkipModule("fresno_grizzlies", ["fresno_grizzlies"])).toBe(true);
    expect(shouldSkipModule("eventbrite_ca", ["fresno_grizzlies"])).toBe(false);
  });

  it("extracts Eventbrite id for sourceEventId", () => {
    expect(resolveSourceEventId(baseEvent)).toBe("eb:1990516589703");
  });

  it("maps website not venunite ticket redirect", () => {
    const [mapped] = mapVenuniteEvents([baseEvent]);
    expect(mapped?.ticketUrl).toContain("eventbrite.com");
    expect(mapped?.ticketUrl).not.toContain("venunite.com");
    expect(mapped?.source).toBe("venunite");
    expect(mapped?.endTs).toBe("2026-06-07T06:00:00.000Z");
  });

  it("filters skipModules in batch", () => {
    const grizzlies = { ...baseEvent, sourceModule: "fresno_grizzlies", id: 1 };
    const events = mapVenuniteEvents([baseEvent, grizzlies]);
    expect(events).toHaveLength(1);
  });

  it("skips LDS church venue events", () => {
    const ward = {
      ...baseEvent,
      id: 1736431,
      title: "Ward Youth Activity",
      venue: {
        name: "The Church of Jesus Christ of Latter-day Saints",
        slug: "the-church-of-jesus-christ-of-latter-day-saints-fresno-ca",
        city: "Fresno",
        state: "CA"
      }
    };
    expect(shouldSkipVenue(ward)).toBe(true);
    expect(mapVenuniteEvents([baseEvent, ward])).toHaveLength(1);
  });

  it("maps categories", () => {
    expect(mapVenuniteCategory("music", ["Music"])).toBe("music");
    expect(mapVenuniteCategory("comedy", ["Comedy"])).toBe("comedy");
  });
});
