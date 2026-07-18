import { describe, expect, it } from "vitest";

import { shouldStopGeocodeBatches } from "./venue-geocode.service";

describe("shouldStopGeocodeBatches", () => {
  it("stops when nothing is left to scan", () => {
    expect(
      shouldStopGeocodeBatches({
        scanned: 0,
        geocoded: 0,
        skipped: 0,
        errors: 0,
        venueScanned: 0,
        candidateScanned: 0,
        candidateGeocoded: 0
      })
    ).toBe(true);
  });

  it("stops when a batch makes no progress", () => {
    expect(
      shouldStopGeocodeBatches({
        scanned: 10,
        geocoded: 0,
        skipped: 10,
        errors: 0,
        venueScanned: 0,
        candidateScanned: 10,
        candidateGeocoded: 0
      })
    ).toBe(true);
  });

  it("continues when a full batch geocoded successfully", () => {
    expect(
      shouldStopGeocodeBatches({
        scanned: 50,
        geocoded: 48,
        skipped: 2,
        errors: 0,
        venueScanned: 0,
        candidateScanned: 50,
        candidateGeocoded: 48
      })
    ).toBe(false);
  });

  it("stops after a partial final batch", () => {
    expect(
      shouldStopGeocodeBatches({
        scanned: 12,
        geocoded: 12,
        skipped: 0,
        errors: 0,
        venueScanned: 0,
        candidateScanned: 12,
        candidateGeocoded: 12
      })
    ).toBe(true);
  });
});
