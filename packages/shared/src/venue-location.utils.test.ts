import { describe, expect, it } from "vitest";

import {
  buildGoogleMapsSearchUrl,
  buildMapsSearchQuery,
  normalizeVenueStreetAddress,
  parseMailingAddress,
  parseStreetFromFullAddress,
  resolveVenueLocationFields
} from "./venue-location.utils.js";

describe("venue-location.utils", () => {
  it("strips trailing USA from mailing addresses before parsing", () => {
    expect(parseMailingAddress("2600 Fresno St, Fresno, CA 93721, USA")).toEqual({
      street: "2600 Fresno St",
      city: "Fresno",
      state: "CA",
      zip: "93721"
    });
    expect(normalizeVenueStreetAddress("2600 Fresno St, Fresno, CA 93721, USA", "Fresno")).toBe(
      "2600 Fresno St"
    );
  });

  it("parses street from a full mailing address", () => {
    expect(
      parseStreetFromFullAddress("5090 East Clinton Way, Fresno, CA 93727", {
        city: "Fresno",
        state: "CA",
        zip: "93727"
      })
    ).toBe("5090 East Clinton Way");
  });

  it("normalizes venue street when city suffix is embedded", () => {
    expect(normalizeVenueStreetAddress("730 M Street, Fresno, CA 93721", "Fresno")).toBe("730 M Street");
  });

  it("parses Central Valley cities without an explicit city hint", () => {
    expect(normalizeVenueStreetAddress("526 Spruce Avenue, Clovis, CA 93611")).toBe("526 Spruce Avenue");
    expect(parseMailingAddress("1665 Simpson St, Kingsburg, CA 93631")).toEqual({
      street: "1665 Simpson St",
      city: "Kingsburg",
      state: "CA",
      zip: "93631"
    });
  });

  it("strips state+zip when city is missing from the line", () => {
    expect(normalizeVenueStreetAddress("6022 N Figarden Dr, CA 93722")).toBe("6022 N Figarden Dr");
  });

  it("removes duplicated mailing suffixes", () => {
    expect(normalizeVenueStreetAddress("4231 E Shields Ave, Fresno, CA 93726, Fresno, CA 93726", "Fresno")).toBe(
      "4231 E Shields Ave"
    );
  });

  it("strips trailing commas and punctuation from street lines", () => {
    expect(normalizeVenueStreetAddress("326 N Irwin St,", "Hanford")).toBe("326 N Irwin St");
    expect(normalizeVenueStreetAddress("2650 East Shaw Ave.", "Clovis")).toBe("2650 East Shaw Ave");
    expect(resolveVenueLocationFields("326 N Irwin St,", "Hanford")).toEqual({
      venueAddress: "326 N Irwin St",
      venueCity: "Hanford"
    });
  });

  it("resolveVenueLocationFields fills city from the mailing line when absent", () => {
    expect(resolveVenueLocationFields("808 4th Street, Clovis, CA 93612")).toEqual({
      venueAddress: "808 4th Street",
      venueCity: "Clovis"
    });
  });

  it("prefers coordinates for maps query", () => {
    expect(buildMapsSearchQuery({ lat: 36.7378, lng: -119.7871 })).toBe("36.7378,-119.7871");
  });

  it("builds a Google Maps search URL from address parts", () => {
    const url = buildGoogleMapsSearchUrl({
      address: "1400 Fulton St",
      city: "Fresno",
      state: "CA"
    });
    expect(url).toContain("google.com/maps/search");
    expect(url).toContain(encodeURIComponent("1400 Fulton St, Fresno, CA"));
  });
});
