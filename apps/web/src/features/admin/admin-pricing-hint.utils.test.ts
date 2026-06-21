import { describe, expect, it } from "vitest";

import { inferAdminPricingHint } from "./admin-pricing-hint.utils";

describe("inferAdminPricingHint", () => {
  it("detects free events", () => {
    expect(inferAdminPricingHint({ source: "manual", sourceEventId: "1", title: "T", venueName: "V", startTs: "2026-01-01T12:00:00Z", isFree: true })).toEqual({
      kind: "free",
      label: "Free"
    });
  });

  it("shows numeric ranges", () => {
    expect(
      inferAdminPricingHint({
        source: "ticketmaster",
        sourceEventId: "1",
        title: "T",
        venueName: "V",
        startTs: "2026-01-01T12:00:00Z",
        priceMin: 25,
        priceMax: 75
      })
    ).toEqual({ kind: "priced", label: "$25-75" });
  });

  it("does not infer paid from ticket URL alone", () => {
    const hint = inferAdminPricingHint({
      source: "ticketmaster",
      sourceEventId: "1",
      title: "Monster Jam",
      venueName: "Save Mart Center",
      startTs: "2026-08-22T02:00:00Z",
      ticketUrl: "https://www.ticketmaster.com/event/abc"
    });
    expect(hint).toEqual({
      kind: "unknown",
      label: "No price from source — check Free or enter min/max; list shows See Tickets for price when a ticket URL is set"
    });
  });

  it("returns null when there is no price signal and no ticket URL", () => {
    expect(
      inferAdminPricingHint({
        source: "api:visitfresnocounty",
        sourceEventId: "1",
        title: "ArtHop",
        venueName: "Downtown",
        startTs: "2026-01-01T12:00:00Z"
      })
    ).toBeNull();
  });

  it("shows priceNotes text without inferring paid/free", () => {
    expect(
      inferAdminPricingHint({
        source: "api:visitfresnocounty",
        sourceEventId: "1",
        title: "T",
        venueName: "V",
        startTs: "2026-01-01T12:00:00Z",
        priceNotes: "Donations welcome"
      })
    ).toEqual({ kind: "priced", label: "Donations welcome" });
  });
});
