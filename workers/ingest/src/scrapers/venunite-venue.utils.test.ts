import { describe, expect, it, vi } from "vitest";

import type { VenuniteEvent } from "./venunite.types";
import { collectVenuniteVenueIds, loadVenuniteVenueDetails } from "./venunite-venue.utils";
import { resolveVenuniteVenueLocation } from "./venunite.utils";

describe("venunite-venue.utils", () => {
  it("collects unique venue ids for non-skipped modules", () => {
    const events: VenuniteEvent[] = [
      { id: 1, title: "A", slug: "a", startDate: "2026-01-01T00:00:00.000Z", source: "x", sourceModule: "eventbrite_ca", venueId: 10 },
      { id: 2, title: "B", slug: "b", startDate: "2026-01-01T00:00:00.000Z", source: "x", sourceModule: "fresno_grizzlies", venueId: 99 },
      { id: 3, title: "C", slug: "c", startDate: "2026-01-01T00:00:00.000Z", source: "x", sourceModule: "eventbrite_ca", venueId: 10 }
    ];

    expect(collectVenuniteVenueIds(events, ["fresno_grizzlies"])).toEqual([10]);
  });

  it("caches venue detail fetches", async () => {
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        id: 422038,
        name: "Wyndham Garden Fresno Airport",
        address: "5090 East Clinton Way, Fresno, CA 93727",
        city: "Fresno",
        state: "CA",
        zip: "93727"
      })
    });

    const cache = new Map();
    await loadVenuniteVenueDetails([422038, 422038], cache, {
      userAgent: "test",
      delayMs: 0,
      fetchImpl
    });

    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(cache.get(422038)?.address).toContain("Clinton Way");
  });

  it("maps venue detail address and embedded coordinates", () => {
    const event: VenuniteEvent = {
      id: 1,
      title: "Growth Lab",
      slug: "growth-lab",
      startDate: "2026-06-25T00:30:00.000Z",
      source: "scraper:eventbrite_ca",
      sourceModule: "eventbrite_ca",
      venueId: 422038,
      venue: {
        name: "Wyndham Garden Fresno Airport",
        city: "Fresno",
        state: "CA",
        latitude: 36.743,
        longitude: -119.712
      }
    };

    const location = resolveVenuniteVenueLocation(event, {
      id: 422038,
      name: "Wyndham Garden Fresno Airport",
      address: "5090 East Clinton Way, Fresno, CA 93727",
      city: "Fresno",
      state: "CA",
      zip: "93727"
    });

    expect(location.venueAddress).toBe("5090 East Clinton Way");
    expect(location.venueCity).toBe("Fresno");
    expect(location.venueLat).toBe(36.743);
    expect(location.venueLng).toBe(-119.712);
  });
});
