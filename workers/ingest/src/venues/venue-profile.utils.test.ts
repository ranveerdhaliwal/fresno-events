import { describe, expect, it } from "vitest";

import type { VenueConfig } from "@/venues/venue.types";

import { isDetailHostBlocked, resolveDetailMode } from "./venue-profile.utils";

const base = (overrides: Partial<VenueConfig>): VenueConfig =>
  ({
    key: "test",
    label: "Test",
    enabled: true,
    strategy: "listing_then_detail",
    listingUrl: "https://example.com/",
    ...overrides
  }) as VenueConfig;

describe("venue-profile.utils", () => {
  it("resolveDetailMode honors config", () => {
    expect(resolveDetailMode(base({ detailMode: "none" }))).toBe("none");
    expect(resolveDetailMode(base({ strategy: "api", eventSource: "api:x" }))).toBe("api_embedded");
  });

  it("isDetailHostBlocked blocks configured hosts", () => {
    const config = base({ blockedDetailHosts: ["eventbrite.com"] });
    expect(isDetailHostBlocked("https://www.eventbrite.com/e/foo", config)).toBe(true);
    expect(isDetailHostBlocked("https://fulton55.com/show", config)).toBe(false);
  });
});
