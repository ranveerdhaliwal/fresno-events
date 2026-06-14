import { describe, expect, it } from "vitest";

import { resolveConventionVenueLocation } from "./convention-venue-location.utils";

describe("resolveConventionVenueLocation", () => {
  it("defaults Saroyan Theatre to 730 M St", () => {
    expect(resolveConventionVenueLocation("Saroyan Theatre")).toEqual({
      venueAddress: "730 M St",
      venueCity: "Fresno",
      venueLat: 36.7347,
      venueLng: -119.7847
    });
    expect(resolveConventionVenueLocation("William Saroyan Theatre")).toEqual({
      venueAddress: "730 M St",
      venueCity: "Fresno",
      venueLat: 36.7347,
      venueLng: -119.7847
    });
  });

  it("defaults Fresno Convention Center to 848 M Street", () => {
    expect(resolveConventionVenueLocation("Fresno Convention Center")).toEqual({
      venueAddress: "848 M Street",
      venueCity: "Fresno",
      venueLat: 36.7346,
      venueLng: -119.7853
    });
  });

  it("returns empty for unknown venue names", () => {
    expect(resolveConventionVenueLocation("Selland Arena")).toEqual({});
  });
});
