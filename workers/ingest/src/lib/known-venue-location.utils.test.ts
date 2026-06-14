import { describe, expect, it } from "vitest";

import { applyKnownVenueLocation, resolveKnownVenueLocation } from "./known-venue-location.utils";

describe("resolveKnownVenueLocation", () => {
  it("defaults Rainbow Ballroom to 1725 Broadway St", () => {
    expect(resolveKnownVenueLocation("Rainbow Ballroom")).toEqual({
      venueAddress: "1725 Broadway St",
      venueCity: "Fresno",
      venueLat: 36.7402635,
      venueLng: -119.7994878
    });
  });

  it("defaults Strummers to 833 E Fern Ave", () => {
    expect(resolveKnownVenueLocation("Strummers")).toMatchObject({
      venueAddress: "833 E Fern Ave",
      venueLat: 36.7589629
    });
  });

  it("defaults Fulton 55 to 875 Divisadero St", () => {
    expect(resolveKnownVenueLocation("Fulton 55")).toMatchObject({
      venueAddress: "875 Divisadero St",
      venueCity: "Fresno"
    });
  });

  it("defaults Chukchansi Park for MiLB home games", () => {
    expect(resolveKnownVenueLocation("Chukchansi Park")).toMatchObject({
      venueAddress: "1800 Tulare St",
      venueLat: 36.7328
    });
  });

  it("defaults downtown Fresno venues", () => {
    expect(resolveKnownVenueLocation("Warnors Center for the Performing Arts")).toMatchObject({
      venueAddress: "1400 Fulton St"
    });
    expect(resolveKnownVenueLocation("CMAC - Community Media Access Collaborative")).toMatchObject({
      venueAddress: "1555 Van Ness Ave"
    });
  });

  it("returns empty for away-game style venue names", () => {
    expect(resolveKnownVenueLocation("Columbus, OH")).toEqual({});
    expect(resolveKnownVenueLocation("Banner Island Ballpark")).toEqual({});
  });
});

describe("applyKnownVenueLocation", () => {
  it("fills missing fields without overwriting existing address or coords", () => {
    const patched = applyKnownVenueLocation({
      source: "scrape:rainbowballroom.com",
      sourceEventId: "x",
      title: "Show",
      venueName: "Rainbow Ballroom",
      startTs: "2026-06-18T03:00:00.000Z",
      venueLat: 36.74,
      venueLng: -119.8
    });
    expect(patched.venueAddress).toBe("1725 Broadway St");
    expect(patched.venueLat).toBe(36.74);
    expect(patched.venueLng).toBe(-119.8);
  });

  it("leaves unrelated events unchanged", () => {
    const event = {
      source: "api:milb" as const,
      sourceEventId: "away",
      title: "Away",
      venueName: "Excite Ballpark",
      startTs: "2026-06-18T03:00:00.000Z"
    };
    expect(applyKnownVenueLocation(event)).toEqual(event);
  });
});
