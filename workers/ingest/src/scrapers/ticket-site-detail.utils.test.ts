import { describe, expect, it, vi } from "vitest";

import type { NormalizedEvent } from "@fresno-events/shared";

import {
  fetchAndMergeTicketSiteDetail,
  resolveTicketSiteUrlFromEvent
} from "./ticket-site-detail.utils";

const WHO_TRIBUTE_TICKETS_HTML = `
<script>
  pricing: [ {'category':1, 'price': 38.83}, {'category':2, 'price': 33.68}, {'category':3, 'price': 28.53} ],
</script>
`;

describe("ticket-site-detail.utils", () => {
  it("detects TicketSauce URLs on any source", () => {
    const event: NormalizedEvent = {
      source: "venunite",
      sourceEventId: "vu:123",
      title: "THE WHO Tribute",
      venueName: "Tower Theatre",
      venueCity: "Fresno",
      startTs: "2026-11-07T03:00:00.000Z",
      ticketUrl: "https://towertheatre.ticketsauce.com/e/the-who-tribute"
    };
    expect(resolveTicketSiteUrlFromEvent(event)).toEqual({
      host: "ticketsauce",
      url: "https://towertheatre.ticketsauce.com/e/the-who-tribute"
    });
  });

  it("fetches tickets page and merges all-in prices", async () => {
    const fetchMock = vi.fn(async (url: string) => {
      expect(url).toBe("https://towertheatre.ticketsauce.com/e/the-who-tribute/tickets");
      return new Response(WHO_TRIBUTE_TICKETS_HTML, { status: 200 });
    });
    vi.stubGlobal("fetch", fetchMock);

    const event: NormalizedEvent = {
      source: "scrape:towertheatre.ticketsauce.com",
      sourceEventId: "venue:tower:who",
      title: "THE WHO Tribute",
      venueName: "Tower Theatre",
      venueCity: "Fresno",
      startTs: "2026-11-07T03:00:00.000Z",
      priceMin: 22,
      priceMax: 32,
      externalUrl: "https://towertheatre.ticketsauce.com/e/the-who-tribute"
    };

    const merged = await fetchAndMergeTicketSiteDetail(event, { userAgent: "test-agent" });
    expect(merged.priceMin).toBe(29);
    expect(merged.priceMax).toBe(39);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    vi.unstubAllGlobals();
  });
});
