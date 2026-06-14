import { describe, expect, it } from "vitest";

import { applyChaffeeVenueLocation, resolveChaffeeVenueLocation } from "./chaffee-venue-location.utils";

describe("resolveChaffeeVenueLocation", () => {
  it("defaults Fresno Chaffee Zoo to 894 W. Belmont Avenue", () => {
    expect(resolveChaffeeVenueLocation("Fresno Chaffee Zoo")).toEqual({
      venueAddress: "894 W. Belmont Avenue",
      venueCity: "Fresno",
      venueLat: 36.7519,
      venueLng: -119.8235
    });
  });

  it("returns empty for unrelated venue names", () => {
    expect(resolveChaffeeVenueLocation("Selland Arena")).toEqual({});
  });
});

describe("applyChaffeeVenueLocation", () => {
  it("merges location onto parsed events", () => {
    const event = applyChaffeeVenueLocation({
      source: "scrape:fcz.org",
      sourceEventId: "venue:chaffee-zoo:breakfast",
      title: "Breakfast With The Animals",
      venueName: "Fresno Chaffee Zoo",
      startTs: "2026-07-25T15:00:00.000Z",
      category: "family"
    });
    expect(event.venueAddress).toBe("894 W. Belmont Avenue");
    expect(event.venueLat).toBe(36.7519);
  });
});
