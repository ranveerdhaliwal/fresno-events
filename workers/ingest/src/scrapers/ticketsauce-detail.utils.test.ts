import { describe, expect, it } from "vitest";

import type { NormalizedEvent } from "@fresno-events/shared";

import {
  mergeTicketSauceDetail,
  parseTicketSauceAllInInputPrices,
  parseTicketSaucePricingArray,
  parseTicketSauceTicketsPage,
  resolveTicketSauceTicketsUrl,
  roundTicketSauceDisplayPrice
} from "./ticketsauce-detail.utils";

const WHO_TRIBUTE_TICKETS_SNIPPET = `
<script>
  var ticketTypeCategories = {"1":{"ticket_type_id":"a"},"2":{"ticket_type_id":"b"},"3":{"ticket_type_id":"c"}};
  pricing: [ {'category':1, 'price': 38.83}, {'category':2, 'price': 33.68}, {'category':3, 'price': 28.53} ],
</script>
<input ticket_type_name data-field-name="ticket_type_name" value="RESERVE PARKING" data-default-all-in-price-each="26.47" />
`;

describe("ticketsauce-detail.utils", () => {
  it("resolves event and tickets URLs", () => {
    expect(
      resolveTicketSauceTicketsUrl("https://towertheatre.ticketsauce.com/e/the-who-tribute")
    ).toBe("https://towertheatre.ticketsauce.com/e/the-who-tribute/tickets");
    expect(
      resolveTicketSauceTicketsUrl("https://towertheatre.ticketsauce.com/e/the-who-tribute/tickets?ref=1")
    ).toBe("https://towertheatre.ticketsauce.com/e/the-who-tribute/tickets");
  });

  it("parses seat-map all-in pricing array", () => {
    expect(parseTicketSaucePricingArray(WHO_TRIBUTE_TICKETS_SNIPPET)).toEqual([38.83, 33.68, 28.53]);
  });

  it("parses all-in input prices and excludes parking", () => {
    const html = `
      <input ticket_type_name value="BACK" data-default-all-in-price-each="28.53" />
      <input ticket_type_name value="RESERVE PARKING" data-default-all-in-price-each="26.47" />
    `;
    expect(parseTicketSauceAllInInputPrices(html)).toEqual([28.53]);
  });

  it("returns all-in min/max for THE WHO Tribute", () => {
    const detail = parseTicketSauceTicketsPage(
      WHO_TRIBUTE_TICKETS_SNIPPET,
      "https://towertheatre.ticketsauce.com/e/the-who-tribute/tickets"
    );
    expect(detail).toEqual({
      priceMin: 29,
      priceMax: 39,
      ticketUrl: "https://towertheatre.ticketsauce.com/e/the-who-tribute/tickets",
      priceIncludesFees: true
    });
  });

  it("rounds display prices up to whole dollars", () => {
    expect(roundTicketSauceDisplayPrice(28.53)).toBe(29);
    expect(roundTicketSauceDisplayPrice(38.83)).toBe(39);
  });

  it("replaces face-value JSON-LD prices with all-in ticket-page prices", () => {
    const listing: NormalizedEvent = {
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

    const merged = mergeTicketSauceDetail(listing, {
      priceMin: 29,
      priceMax: 39,
      ticketUrl: "https://towertheatre.ticketsauce.com/e/the-who-tribute/tickets",
      priceIncludesFees: true
    });

    expect(merged.priceMin).toBe(29);
    expect(merged.priceMax).toBe(39);
    expect(merged.ticketUrl).toBe("https://towertheatre.ticketsauce.com/e/the-who-tribute/tickets");
  });

  it("returns null when tickets page has no all-in price signals", () => {
    const html = `
      <script type="application/ld+json">
      {"offers":[{"name":"General Admission","price":"10.00"}]}
      </script>
    `;
    expect(
      parseTicketSauceTicketsPage(html, "https://towertheatre.ticketsauce.com/e/the-raid-redemption/tickets")
    ).toBeNull();
  });
});
