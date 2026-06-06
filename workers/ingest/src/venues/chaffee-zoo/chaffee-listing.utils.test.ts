import { describe, expect, it } from "vitest";

import type { VenueConfig } from "@/venues/venue.types";

import { parseChaffeeListingHtml } from "./chaffee-listing.utils";
import configJson from "./venue.config.json";

const config = configJson as VenueConfig;

const SAMPLE = `
  <h3>Breakfast With The Animals &#8211; July 25th</h3>
  <p>Saturday, July 25th 8:00AM-10:00AM. Tickets will be available soon.</p>
  <h3>Rainbow Family Day &#8211; October 11th</h3>
  <p>Sunday, October 11th 10AM-2PM</p>
  <a href="https://www.ticketapp.org/portal/product/BFF">GET TICKETS</a>
`;

describe("parseChaffeeListingHtml", () => {
  it("parses zoo events from listing HTML", () => {
    const events = parseChaffeeListingHtml(SAMPLE, config, new Date("2026-06-05T12:00:00Z"));
    expect(events.length).toBe(2);
    expect(events[0]?.title).toBe("Breakfast With The Animals");
    expect(events[0]?.source).toBe("scrape:fcz.org");
    expect(events[1]?.title).toContain("Rainbow Family Day");
  });
});
