import { afterEach, describe, expect, it, vi } from "vitest";

import type { TicketmasterEvent, TicketmasterResponse } from "./ticketmaster.types";
import { toCategory, toLocalDateTime } from "./ticketmaster.types";
import { fetchAllTicketmasterEvents, toNormalizedEvent } from "./ticketmaster.utils";

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

function minimalTicketmasterEvent(id: string): TicketmasterEvent {
  return {
    id,
    name: `Event ${id}`,
    dates: { start: { dateTime: "2026-06-10T02:00:00Z" } },
    _embedded: { venues: [{ name: "Warnors Theatre", city: { name: "Fresno" } }] }
  };
}

function pagePayload(page: number, totalPages: number, events: TicketmasterEvent[]): TicketmasterResponse {
  return {
    _embedded: { events },
    page: { number: page, totalPages, size: events.length }
  };
}

describe("fetchAllTicketmasterEvents", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("stops after maxPages even when Ticketmaster reports more pages", async () => {
    const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    const fetchMock = vi.fn(async (url: string) => {
      const parsed = new URL(url);
      const page = Number(parsed.searchParams.get("page") ?? "0");
      const events = Array.from({ length: 200 }, (_, i) => minimalTicketmasterEvent(`p${page}-e${i}`));
      return new Response(JSON.stringify(pagePayload(page, 10, events)), { status: 200 });
    });
    vi.stubGlobal("fetch", fetchMock);

    const result = await fetchAllTicketmasterEvents({
      apiKey: "test-key",
      lat: 36.7378,
      lng: -119.7871,
      radiusMiles: 25,
      startDateTime: "2026-06-01T00:00:00Z",
      userAgent: "test-agent",
      maxPages: 3
    });

    expect(result.pagesVisited).toBe(3);
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(result.events.length).toBe(600);
    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining('"event":"ticketmaster_pages_capped"')
    );
  });

  it("follows all pages when total is within the default cap", async () => {
    const fetchMock = vi.fn(async (url: string) => {
      const parsed = new URL(url);
      const page = Number(parsed.searchParams.get("page") ?? "0");
      const events =
        page === 0
          ? Array.from({ length: 200 }, (_, i) => minimalTicketmasterEvent(`e${i}`))
          : [minimalTicketmasterEvent("last")];
      const totalPages = 2;
      return new Response(JSON.stringify(pagePayload(page, totalPages, events)), { status: 200 });
    });
    vi.stubGlobal("fetch", fetchMock);

    const result = await fetchAllTicketmasterEvents({
      apiKey: "test-key",
      lat: 36.7378,
      lng: -119.7871,
      radiusMiles: 25,
      startDateTime: "2026-06-01T00:00:00Z",
      userAgent: "test-agent"
    });

    expect(result.pagesVisited).toBe(2);
    expect(result.events.length).toBe(201);
  });
});
