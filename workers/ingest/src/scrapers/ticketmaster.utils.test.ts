import { describe, expect, it } from "vitest";

import type { TicketmasterEvent } from "./ticketmaster.types";
import { toCategory, toLocalDateTime } from "./ticketmaster.types";
import { toNormalizedEvent } from "./ticketmaster.utils";

describe("ticketmaster.utils", () => {
  it("maps discovery event to normalized event", () => {
    const raw: TicketmasterEvent = {
      id: "abc123",
      name: "Sample Show",
      url: "https://www.ticketmaster.com/event/abc123",
      info: "Details here",
      dates: {
        timezone: "America/Los_Angeles",
        start: { dateTime: "2026-06-10T02:00:00Z" }
      },
      classifications: [{ segment: { name: "Music" }, genre: { name: "Rock" } }],
      _embedded: {
        venues: [
          {
            name: "Warnors Theatre",
            address: { line1: "1400 Fulton St" },
            city: { name: "Fresno" },
            location: { latitude: "36.7378", longitude: "-119.7871" }
          }
        ]
      }
    };

    const [event] = toNormalizedEvent(raw);
    expect(event?.source).toBe("ticketmaster");
    expect(event?.sourceEventId).toBe("abc123");
    expect(event?.category).toBe("music");
    expect(event?.venueCity).toBe("Fresno");
    expect(event?.venueLat).toBe(36.7378);
    expect(event?.venueLng).toBe(-119.7871);
  });

  it("builds local date time fallback", () => {
    expect(toLocalDateTime("2026-06-10", "19:30:00")).toBe("2026-06-10T19:30:00-07:00");
    expect(toLocalDateTime(undefined)).toBeNull();
  });

  it("maps sports category", () => {
    expect(toCategory({ segment: { name: "Sports" } })).toBe("sports");
  });

  it("omits price and coords when Discovery API does not provide them", () => {
    const raw: TicketmasterEvent = {
      id: "monster-jam",
      name: "Monster Jam",
      url: "https://www.ticketmaster.com/event/monster-jam",
      dates: {
        timezone: "America/Los_Angeles",
        start: { dateTime: "2026-08-22T02:00:00Z" }
      },
      classifications: [{ segment: { name: "Sports" } }],
      _embedded: {
        venues: [
          {
            name: "Save Mart Center",
            address: { line1: "2650 East Shaw Ave." },
            city: { name: "Fresno" }
          }
        ]
      }
    };

    const [event] = toNormalizedEvent(raw);
    expect(event?.venueAddress).toBe("2650 East Shaw Ave.");
    expect(event?.priceMin).toBeUndefined();
    expect(event?.priceMax).toBeUndefined();
    expect(event?.venueLat).toBeUndefined();
    expect(event?.venueLng).toBeUndefined();
    expect(event?.ticketUrl).toContain("ticketmaster.com");
  });

  it("maps priceRanges when Discovery includes them", () => {
    const raw: TicketmasterEvent = {
      id: "tm-priced",
      name: "Comedy Show",
      dates: { start: { dateTime: "2026-06-10T02:00:00Z" } },
      priceRanges: [{ min: 25, max: 75, currency: "USD" }],
      _embedded: { venues: [{ name: "Warnors Theatre", city: { name: "Fresno" } }] }
    };

    const [event] = toNormalizedEvent(raw);
    expect(event?.priceMin).toBe(25);
    expect(event?.priceMax).toBe(75);
  });
});
