import { describe, expect, it, vi } from "vitest";

import type { NormalizedEvent } from "@fresno-events/shared";

import { enrichApiVenueEventsWithDetailPrices } from "./api-venue-price-detail.utils";

const TOWER_DETAIL_HTML = `
<html><body>
  <h1>Local Show</h1>
  <script type="application/ld+json">
  {"@context":"http://schema.org","@type":"MusicEvent","name":"Local Show","startDate":"2026-07-01T19:00:00-07:00","offers":[{"@type":"Offer","name":"General Admission","price":"22.00","priceCurrency":"USD","url":"https://towertheatre.ticketsauce.com/e/local-show/tickets"}]}
  </script>
</body></html>
`;

describe("enrichApiVenueEventsWithDetailPrices", () => {
  it("retains a detail description even when the venue advertises no prices", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () =>
          new Response(
            `<script type="application/ld+json">${JSON.stringify({
              "@type": "MusicEvent",
              name: "YG",
              startDate: "2026-11-02T03:00:00Z",
              location: { name: "Save Mart Center" },
              description: "YG performs with special guests."
            })}</script>`
          )
      )
    );
    const result = await enrichApiVenueEventsWithDetailPrices(
      [
        {
          source: "scrape:www.savemartcenter.com",
          sourceEventId: "yg",
          title: "YG",
          venueName: "Save Mart Center",
          startTs: "2026-11-02T03:00:00Z",
          category: "music",
          externalUrl: "https://www.savemartcenter.com/event/yg/"
        }
      ],
      {
        key: "save-mart",
        label: "Save Mart Center",
        enabled: true,
        strategy: "api",
        listingUrl: "https://www.savemartcenter.com/events-tickets/",
        detailMode: "plain_html"
      },
      "test-agent"
    );
    expect(result.events[0]?.descriptionText).toBe("YG performs with special guests.");
    expect(result.events[0]?.priceMin).toBeUndefined();
    expect(result.events[0]?.startTs).toBe("2026-11-02T03:00:00Z");
    vi.unstubAllGlobals();
  });
  it("keeps the API date when a detail page has no date metadata", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () =>
          new Response(
            '<h1>YG</h1><meta property="og:description" content="YG performs live at Save Mart Center.">'
          )
      )
    );
    const result = await enrichApiVenueEventsWithDetailPrices(
      [
        {
          source: "scrape:www.savemartcenter.com",
          sourceEventId: "yg",
          title: "YG",
          venueName: "Save Mart Center",
          startTs: "2026-11-02T03:00:00Z",
          category: "music",
          externalUrl: "https://www.savemartcenter.com/event/yg/"
        }
      ],
      {
        key: "save-mart",
        label: "Save Mart Center",
        enabled: true,
        strategy: "api",
        listingUrl: "https://www.savemartcenter.com/events-tickets/",
        detailMode: "plain_html"
      },
      "test-agent"
    );
    expect(result.events[0]?.startTs).toBe("2026-11-02T03:00:00Z");
    vi.unstubAllGlobals();
  });
  it("merges JSON-LD prices from venue detail pages for API listings", async () => {
    const fetchMock = vi.fn(async () => new Response(TOWER_DETAIL_HTML, { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    const events: NormalizedEvent[] = [
      {
        source: "scrape:www.savemartcenter.com",
        sourceEventId: "venue:save-mart:1",
        title: "Local Show",
        venueName: "Save Mart Center",
        venueCity: "Fresno",
        startTs: "2026-07-02T02:00:00.000Z",
        externalUrl: "https://www.savemartcenter.com/event/local-show/1/"
      }
    ];

    const result = await enrichApiVenueEventsWithDetailPrices(
      events,
      {
        key: "save-mart",
        label: "Save Mart Center",
        enabled: true,
        strategy: "api",
        listingUrl: "https://www.savemartcenter.com/events-tickets/",
        sourceHostname: "www.savemartcenter.com",
        detailMode: "plain_html"
      },
      "test-agent"
    );

    expect(result.detailUrlsVisited).toBe(1);
    expect(result.events[0]?.priceMin).toBe(22);
    vi.unstubAllGlobals();
  });

  it("skips when detailMode is api_embedded", async () => {
    const events: NormalizedEvent[] = [
      {
        source: "scrape:www.savemartcenter.com",
        sourceEventId: "venue:save-mart:1",
        title: "Local Show",
        venueName: "Save Mart Center",
        venueCity: "Fresno",
        startTs: "2026-07-02T02:00:00.000Z",
        externalUrl: "https://www.savemartcenter.com/event/local-show/1/"
      }
    ];

    const result = await enrichApiVenueEventsWithDetailPrices(
      events,
      {
        key: "save-mart",
        label: "Save Mart Center",
        enabled: true,
        strategy: "api",
        listingUrl: "https://www.savemartcenter.com/events-tickets/",
        detailMode: "api_embedded"
      },
      "test-agent"
    );

    expect(result).toEqual({ events, detailUrlsVisited: 0 });
  });
});
