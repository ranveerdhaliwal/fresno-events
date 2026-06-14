import { describe, expect, it } from "vitest";

import type { VenueConfig } from "@/venues/venue.types";

import { CHAFFEE_ZOO_DEFAULT_IMAGE_URL, parseChaffeeListingHtml } from "./chaffee-listing.utils";
import configJson from "./venue.config.json";

const config = configJson as VenueConfig;

const SAMPLE = `
  <h3>Breakfast With The Animals &#8211; July 25th</h3>
  <p>Saturday, July 25th 8:00AM-10:00AM.</p>
  <p>Start your day with a wild adventure! Join us for Breakfast with the Animals, a one-of-a-kind morning experience that combines delicious food and early access to the zoo.</p>
  <a href="https://www.ticketapp.org/portal/product/151">GET TICKETS</a>
  <h3>Safari Night Gala &#8211; September 18th</h3>
  <p>Friday, September 18th 6:00PM-11:30PM.</p>
  <a href="https://www.ticketapp.org/portal/product/gala">GET TICKETS</a>
  <h3>Rainbow Family Day &#8211; October 11th</h3>
  <p>A celebration of community and belonging at Fresno Chaffee Zoo in honor of National Coming Out Day. This joyful event uplifts and affirms LGBTQIA+ families.</p>
  <p>Sunday, October 11th 10AM-2PM</p>
  <a href="https://www.ticketapp.org/portal/product/BFF">GET TICKETS</a>
`;

describe("parseChaffeeListingHtml", () => {
  it("parses zoo events from listing HTML", () => {
    const events = parseChaffeeListingHtml(SAMPLE, config, new Date("2026-06-05T12:00:00Z"));
    expect(events.length).toBe(3);
    expect(events[0]?.title).toBe("Breakfast With The Animals");
    expect(events[0]?.source).toBe("scrape:fcz.org");
    expect(events[0]?.descriptionText).toContain("wild adventure");
    expect(events[1]?.title).toBe("Safari Night Gala");
    expect(events[1]?.descriptionText).toBeUndefined();
    expect(events[2]?.title).toContain("Rainbow Family Day");
    expect(events[2]?.descriptionText).toContain("National Coming Out Day");
    expect(events.every((e) => e.imageUrl === CHAFFEE_ZOO_DEFAULT_IMAGE_URL)).toBe(true);
    expect(events.every((e) => e.showVenueLogoInList === true)).toBe(true);
    expect(events.every((e) => e.listVenueLogoPadding === 2)).toBe(true);
    expect(events[0]?.venueAddress).toBe("894 W. Belmont Avenue");
    expect(events[0]?.venueCity).toBe("Fresno");
    expect(events[0]?.venueLat).toBe(36.7519);
    expect(events[0]?.venueLng).toBe(-119.8235);
  });
});
