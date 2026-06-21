import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import {
  isEventbriteEventUrl,
  mergeEventbriteDetail,
  parseEventbriteDetailHtml,
  parseEventbriteOffersPrices,
  preserveEventbriteEnrichedDescription,
  roundEventbriteDisplayPrice,
  shouldReplaceEventbriteDescription
} from "./eventbrite-detail.utils";

const fixturePath = join(import.meta.dirname, "fixtures/eventbrite-alley-detail.html");

describe("eventbrite-detail.utils", () => {
  it("isEventbriteEventUrl accepts www /e/ links and branded subdomains", () => {
    expect(isEventbriteEventUrl("https://www.eventbrite.com/e/crawl-downtown-pride-bar-crawl-tickets-1989716277949")).toBe(
      true
    );
    expect(isEventbriteEventUrl("https://ScreenwritersJune26.eventbrite.com/?aff=CC")).toBe(true);
    expect(isEventbriteEventUrl("https://help.eventbrite.com/s/article/foo")).toBe(false);
    expect(isEventbriteEventUrl("https://www.eventbrite.com/blog/post")).toBe(false);
  });

  it("parseEventbriteDetailHtml extracts structured description from __NEXT_DATA__", () => {
    const html = readFileSync(fixturePath, "utf8");
    const parsed = parseEventbriteDetailHtml(html);
    expect(parsed?.descriptionText).toContain("BIGGER AND BETTER");
    expect(parsed?.descriptionText).toContain("DJs and live performances");
    expect(parsed?.descriptionText).not.toContain("&amp;");
    expect(parsed?.descriptionText).toContain("$40 VIP Admission");
    expect((parsed?.descriptionText?.length ?? 0) > 500).toBe(true);
    expect(parsed?.imageUrl).toContain("img.evbuc.com");
    expect(parsed?.priceMin).toBe(13);
    expect(parsed?.priceMax).toBe(66);
  });

  it("roundEventbriteDisplayPrice rounds up to the next whole dollar", () => {
    expect(roundEventbriteDisplayPrice(12.51)).toBe(13);
    expect(roundEventbriteDisplayPrice(15)).toBe(15);
    expect(roundEventbriteDisplayPrice(65.87)).toBe(66);
    expect(roundEventbriteDisplayPrice(0)).toBe(0);
  });

  it("parseEventbriteOffersPrices rounds fractional ticket prices up", () => {
    const prices = parseEventbriteOffersPrices({
      seo: {
        offersSchema: [
          {
            schemaType: "AggregateOffer",
            priceCurrency: "USD",
            lowPrice: "12.51",
            highPrice: "65.87"
          }
        ]
      }
    });
    expect(prices.priceMin).toBe(13);
    expect(prices.priceMax).toBe(66);
  });

  it("parseEventbriteOffersPrices reads AggregateOffer low/high from seo schema", () => {
    const prices = parseEventbriteOffersPrices({
      seo: {
        offersSchema: [
          {
            schemaType: "AggregateOffer",
            priceCurrency: "USD",
            lowPrice: "15.0",
            highPrice: "15.0"
          }
        ]
      }
    });
    expect(prices.priceMin).toBe(15);
    expect(prices.priceMax).toBe(15);
  });

  it("mergeEventbriteDetail marks free when Eventbrite reports isFree", () => {
    const listing = {
      source: "api:downtownfresno" as const,
      sourceEventId: "https://www.downtownfresno.org/do/screenwriters",
      title: "Central California Screenwriters' Group",
      venueName: "CMAC",
      startTs: "2026-06-23T23:00:00.000Z",
      ticketUrl: "https://ScreenwritersJune26.eventbrite.com/?aff=CC"
    };
    const merged = mergeEventbriteDetail(listing, { isFree: true, priceMin: 0, priceMax: 0 });
    expect(merged.isFree).toBe(true);
    expect(merged.priceMin).toBe(0);
    expect(merged.priceMax).toBe(0);
  });

  it("mergeEventbriteDetail adds price when listing has none", () => {
    const listing = {
      source: "api:downtownfresno" as const,
      sourceEventId: "https://www.downtownfresno.org/do/pride-crawl",
      title: "Pride Crawl",
      venueName: "Downtown Fresno",
      startTs: "2026-06-21T00:00:00.000Z",
      ticketUrl: "https://www.eventbrite.com/e/event-1989716277949"
    };
    const merged = mergeEventbriteDetail(listing, { priceMin: 15, priceMax: 15 });
    expect(merged.priceMin).toBe(15);
    expect(merged.priceMax).toBe(15);
  });

  it("mergeEventbriteDetail adds hero image when listing has none", () => {
    const listing = {
      source: "api:downtownfresno" as const,
      sourceEventId: "https://www.downtownfresno.org/do/pride-crawl",
      title: "Pride Crawl",
      venueName: "Downtown Fresno",
      startTs: "2026-06-21T00:00:00.000Z",
      descriptionText: "Long downtown description from the partnership page with plenty of detail."
    };
    const merged = mergeEventbriteDetail(listing, {
      imageUrl: "https://img.evbuc.com/example.jpg"
    });
    expect(merged.imageUrl).toBe("https://img.evbuc.com/example.jpg");
    expect(merged.descriptionText).toBe(listing.descriptionText);
  });

  it("mergeEventbriteDetail keeps original description when Eventbrite is not materially longer", () => {
    const originalDescription =
      "Participating bars and restaurants in Downtown Fresno want you to feel welcome. ".repeat(8);
    const listing = {
      source: "api:downtownfresno" as const,
      sourceEventId: "https://www.downtownfresno.org/do/pride-crawl",
      title: "Pride Crawl",
      venueName: "Downtown Fresno",
      startTs: "2026-06-21T00:00:00.000Z",
      descriptionText: originalDescription
    };
    const merged = mergeEventbriteDetail(listing, {
      descriptionText: `${originalDescription} Extra Eventbrite-only paragraph.`,
      imageUrl: "https://img.evbuc.com/example.jpg"
    });
    expect(merged.descriptionText).toBe(originalDescription);
    expect(merged.imageUrl).toBe("https://img.evbuc.com/example.jpg");
  });

  it("mergeEventbriteDetail uses Eventbrite description when original has none", () => {
    const listing = {
      source: "scrape:strummers" as const,
      sourceEventId: "strummers:show-1",
      title: "Show",
      venueName: "Strummers",
      startTs: "2026-08-30T01:00:00.000Z",
      ticketUrl: "https://www.eventbrite.com/e/event-123"
    };
    const merged = mergeEventbriteDetail(listing, {
      descriptionText: "Full structured description from Eventbrite."
    });
    expect(merged.descriptionText).toBe("Full structured description from Eventbrite.");
  });

  it("shouldReplaceEventbriteDescription requires >20% longer text", () => {
    expect(shouldReplaceEventbriteDescription("short", "much longer replacement text here")).toBe(true);
    expect(shouldReplaceEventbriteDescription("1234567890", "12345678901")).toBe(false);
  });

  it("mergeEventbriteDetail updates description when structured text is longer", () => {
    const listing = {
      source: "venunite" as const,
      sourceEventId: "eb:1",
      title: "Show",
      venueName: "Venue",
      startTs: "2026-08-30T01:00:00.000Z",
      descriptionText: "Short summary.",
      priceMin: 13,
      priceMax: 66
    };
    const merged = mergeEventbriteDetail(listing, {
      descriptionText: "A much longer structured description from Eventbrite with extra detail.",
      priceMin: 40,
      priceMax: 66
    });
    expect(merged.descriptionText).toContain("structured description");
    expect(merged.priceMin).toBe(13);
    expect(merged.priceMax).toBe(66);
  });

  it("preserveEventbriteEnrichedDescription keeps stored copy when materially longer on re-promote", () => {
    const existing = {
      source: "venunite" as const,
      sourceEventId: "eb:1",
      title: "Show",
      venueName: "Venue",
      startTs: "2026-08-30T01:00:00.000Z",
      descriptionText: "Long Eventbrite structured description text with much more detail than the aggregator summary."
    };
    const incoming = {
      ...existing,
      descriptionText: "Short Venunite summary."
    };
    const preserved = preserveEventbriteEnrichedDescription(incoming, existing, "fetched");
    expect(preserved.descriptionText).toBe(existing.descriptionText);
  });

  it("preserveEventbriteEnrichedDescription keeps Eventbrite image when rescrape drops it", () => {
    const existing = {
      source: "api:downtownfresno" as const,
      sourceEventId: "https://www.downtownfresno.org/do/pride-crawl",
      title: "Pride Crawl",
      venueName: "Downtown Fresno",
      startTs: "2026-06-21T00:00:00.000Z",
      descriptionText: "Long downtown description.",
      imageUrl: "https://img.evbuc.com/example.jpg",
      priceMin: 15,
      priceMax: 15
    };
    const incoming = {
      ...existing,
      imageUrl: undefined,
      priceMin: undefined,
      priceMax: undefined
    };
    const preserved = preserveEventbriteEnrichedDescription(incoming, existing, "fetched");
    expect(preserved.imageUrl).toBe("https://img.evbuc.com/example.jpg");
    expect(preserved.priceMin).toBe(15);
    expect(preserved.priceMax).toBe(15);
  });

  it("preserveEventbriteEnrichedDescription prefers fresh source text when lengths are close", () => {
    const originalDescription = "A".repeat(2630);
    const existing = {
      source: "api:downtownfresno" as const,
      sourceEventId: "https://www.downtownfresno.org/do/pride-crawl",
      title: "Pride Crawl",
      venueName: "Downtown Fresno",
      startTs: "2026-06-21T00:00:00.000Z",
      descriptionText: `${originalDescription}xxxxx`
    };
    const incoming = {
      ...existing,
      descriptionText: originalDescription
    };
    const preserved = preserveEventbriteEnrichedDescription(incoming, existing, "fetched");
    expect(preserved.descriptionText).toBe(originalDescription);
  });
});
