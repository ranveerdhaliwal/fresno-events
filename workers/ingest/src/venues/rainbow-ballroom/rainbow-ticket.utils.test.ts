import { describe, expect, it } from "vitest";
import type { NormalizedEvent } from "@fresno-events/shared";
import { mergeRainbowTicketDetail } from "./rainbow-ticket.utils";

describe("Rainbow official ticket time", () => {
  const listing: NormalizedEvent = {
    source: "scrape:rainbowballroom.com",
    sourceEventId: "cms-9",
    title: "KAYZO Presents: The Cage",
    venueName: "Rainbow Ballroom",
    startTs: "2026-11-07T02:00:00.000Z",
    ticketUrl: "https://tickets.klinevents.com/e/kayzo2026/tickets",
    category: "music"
  };
  it("uses explicit box office show and end times instead of the earlier CMS timestamp", () => {
    const html = `<script type="application/ld+json">${JSON.stringify({
      "@type": "MusicEvent",
      name: listing.title,
      location: { name: "Rainbow Ballroom" },
      startDate: "2026-11-06T20:00:00-08:00",
      endDate: "2026-11-07T01:30:00-08:00"
    })}</script>`;
    const result = mergeRainbowTicketDetail(listing, html);
    expect(result.startTs).toBe("2026-11-07T04:00:00.000Z");
    expect(result.endTs).toBe("2026-11-07T09:30:00.000Z");
  });
  it("never synthesizes a replacement time from missing or malformed ticket markup", () => {
    expect(mergeRainbowTicketDetail(listing, "<h1>KAYZO Presents: The Cage</h1>")).toBe(listing);
  });
  it("uses POSH startUtc rather than its display wall clock or the earlier venue CMS date", () => {
    const posh = {
      ...listing,
      ticketUrl: "https://posh.vip/e/deathpact-fresno"
    };
    const record = `5:${JSON.stringify({
      props: {
        venueName: "Rainbow Ballroom",
        start: "2026-10-31T20:00:00Z",
        startUtc: "2026-11-01T03:00:00Z",
        endUtc: "2026-11-01T08:30:00Z"
      }
    })}\n`;
    const text = "icon café";
    const flight = `:HL["style.css","style"]\n2f:T${new TextEncoder().encode(text).length.toString(16)},${text}${record}`;
    const html = `<script>self.__next_f.push(${JSON.stringify([1, flight])})</script>`;
    expect(mergeRainbowTicketDetail(posh, html).startTs).toBe("2026-11-01T03:00:00.000Z");
  });
});
