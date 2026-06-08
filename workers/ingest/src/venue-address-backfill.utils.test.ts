import { describe, expect, it } from "vitest";

import { looksLikeMailingLine, normalizeStoredVenueEvent } from "@/venue-address-backfill.utils";

describe("venue-address-backfill.utils", () => {
  it("detects mailing-line addresses", () => {
    expect(looksLikeMailingLine("526 Spruce Avenue, Clovis, CA 93611")).toBe(true);
    expect(looksLikeMailingLine("730 M Street")).toBe(false);
  });

  it("normalizes stored candidate addresses", () => {
    const next = normalizeStoredVenueEvent({
      source: "api:visitfresnocounty",
      sourceEventId: "x",
      title: "Sample",
      venueName: "Venue",
      venueCity: "Clovis",
      startTs: "2026-06-01T00:00:00.000Z",
      venueAddress: "526 Spruce Avenue, Clovis, CA 93611"
    });

    expect(next?.venueAddress).toBe("526 Spruce Avenue");
    expect(next?.venueCity).toBe("Clovis");
  });
});
