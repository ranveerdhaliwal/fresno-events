import { describe, expect, it, vi } from "vitest";

import type { VenuniteEvent } from "./venunite.types";
import {
  buildVenuniteEventDetailApiUrl,
  loadVenuniteEventDetails,
  mergeVenuniteDetailFields,
  parseVenuniteEventDetail,
  resolveVenuniteDescriptionText
} from "./venunite-detail.utils";
import { toNormalizedEvent } from "./venunite.utils";

const workshopDetail = {
  id: 1766900,
  title: "Workshop: Documentary Filmmaking",
  slug: "workshop-documentary-filmmaking",
  startDate: "2026-06-11T01:00:00.000Z",
  endDate: "2026-06-11T03:00:00.000Z",
  timezone: "America/Los_Angeles",
  cost: "$0-$20",
  description: "A blueprint for storytellers!",
  imageUrl:
    "https://img.evbuc.com/https%3A%2F%2Fcdn.evbuc.com%2Fimages%2F1183943178%2F802405643943%2F1%2Foriginal.20260506-181502",
  website: "https://www.eventbrite.com/e/workshop-documentary-filmmaking-tickets-1988932135558",
  source: "scraper:eventbrite_ca",
  sourceModule: "eventbrite_ca",
  priceWatch: { minPriceCents: 2000, currency: "USD" },
  venue: {
    id: 386047,
    name: "CMAC",
    address: "1555 Van Ness Avenue Suite 201, Fresno, CA 93721",
    city: "Fresno",
    state: "CA",
    zip: "93721",
    latitude: 36.7377,
    longitude: -119.7843
  }
};

const listingEvent: VenuniteEvent = {
  id: 1766900,
  title: "Workshop: Documentary Filmmaking",
  slug: "workshop-documentary-filmmaking",
  startDate: "2026-06-11T01:00:00.000Z",
  endDate: "2026-06-11T03:00:00.000Z",
  timezone: "America/Los_Angeles",
  cost: "$0-$20",
  source: "scraper:eventbrite_ca",
  sourceModule: "eventbrite_ca",
  website: "https://www.eventbrite.com/e/workshop-documentary-filmmaking-tickets-1988932135558",
  venue: { name: "CMAC", city: "Fresno", state: "CA" },
  categories: ["Film", "Workshop"],
  category: "arts-culture"
};

describe("venunite-detail.utils", () => {
  it("buildVenuniteEventDetailApiUrl encodes slug", () => {
    expect(buildVenuniteEventDetailApiUrl("foo bar")).toBe(
      "https://venunite.com/api/events/foo%20bar"
    );
  });

  it("parseVenuniteEventDetail rejects error payloads", () => {
    expect(parseVenuniteEventDetail({ error: "Event not found" })).toBeNull();
    expect(parseVenuniteEventDetail(workshopDetail)?.description).toBe("A blueprint for storytellers!");
  });

  it("resolveVenuniteDescriptionText prefers API description over cost stub", () => {
    expect(resolveVenuniteDescriptionText(listingEvent, parseVenuniteEventDetail(workshopDetail))).toBe(
      "A blueprint for storytellers!"
    );
    expect(resolveVenuniteDescriptionText(listingEvent, null)).toBe("Cost: $0-$20");
  });

  it("toNormalizedEvent merges venue address and description from detail API", () => {
    const detail = parseVenuniteEventDetail(workshopDetail);
    const mapped = toNormalizedEvent(listingEvent, new Map(), detail);
    expect(mapped?.descriptionText).toBe("A blueprint for storytellers!");
    expect(mapped?.venueAddress).toContain("Van Ness");
    expect(mapped?.venueLat).toBe(36.7377);
    expect(mapped?.tags).toContain("venunite_slug:workshop-documentary-filmmaking");
    expect(mapped?.ticketUrl).toContain("eventbrite.com");
  });

  it("mergeVenuniteDetailFields adds sold-out tag", () => {
    const base = toNormalizedEvent(listingEvent, new Map(), parseVenuniteEventDetail(workshopDetail))!;
    const merged = mergeVenuniteDetailFields(base, listingEvent, {
      ...parseVenuniteEventDetail(workshopDetail)!,
      soldOut: true
    });
    expect(merged.tags).toContain("sold-out");
  });

  it("loadVenuniteEventDetails caches successful fetches", async () => {
    const fetchImpl = vi.fn(async () => ({
      ok: true,
      json: async () => workshopDetail
    })) as unknown as typeof fetch;

    const cache = new Map();
    const errors: { recoverable?: boolean }[] = [];
    const fetched = await loadVenuniteEventDetails(
      ["workshop-documentary-filmmaking", "workshop-documentary-filmmaking"],
      cache,
      { userAgent: "test", delayMs: 0, fetchImpl },
      errors
    );

    expect(fetched).toBe(1);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(cache.get("workshop-documentary-filmmaking")?.description).toBe("A blueprint for storytellers!");
    expect(errors).toHaveLength(0);
  });
});
