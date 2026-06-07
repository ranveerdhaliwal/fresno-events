import { describe, expect, it } from "vitest";

import type { NormalizedEvent } from "@fresno-events/shared";

import { withDefaultImageUrl } from "./default-image.utils.js";

const base: NormalizedEvent = {
  source: "scrape:example.com",
  sourceEventId: "1",
  title: "Test",
  venueName: "Venue",
  startTs: "2026-06-01T00:00:00.000Z"
};

describe("withDefaultImageUrl", () => {
  it("applies default image when missing", () => {
    const result = withDefaultImageUrl(base, "https://example.com/logo.png");
    expect(result.imageUrl).toBe("https://example.com/logo.png");
    expect(result.showVenueLogoInList).toBeUndefined();
  });

  it("opts into community-priority list display when requested", () => {
    const result = withDefaultImageUrl(base, "https://example.com/logo.png", {
      showInCommunityList: true
    });
    expect(result.showVenueLogoInList).toBe(true);
  });

  it("sets per-venue list logo padding when requested", () => {
    const result = withDefaultImageUrl(base, "https://example.com/logo.png", {
      showInCommunityList: true,
      listVenueLogoPadding: 2
    });
    expect(result.listVenueLogoPadding).toBe(2);
  });

  it("keeps existing imageUrl unchanged", () => {
    const withImage = { ...base, imageUrl: "https://example.com/poster.jpg" };
    const result = withDefaultImageUrl(withImage, "https://example.com/logo.png", {
      showInCommunityList: true
    });
    expect(result).toEqual(withImage);
  });
});
