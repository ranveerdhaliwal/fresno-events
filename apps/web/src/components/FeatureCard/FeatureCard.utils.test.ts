import { describe, expect, it } from "vitest";

import { formatFeaturedBadgeLabel, shouldShowFeaturedBadge } from "./FeatureCard.utils";

describe("FeatureCard.utils", () => {
  it("hides featured time badges on home cards", () => {
    expect(shouldShowFeaturedBadge("default")).toBe(false);
    expect(shouldShowFeaturedBadge("tonight")).toBe(false);
    expect(shouldShowFeaturedBadge("weekend")).toBe(false);
  });

  it("formats badge label", () => {
    expect(formatFeaturedBadgeLabel("tonight")).toBe("TONIGHT");
    expect(formatFeaturedBadgeLabel("weekend")).toBe("WEEKEND");
  });
});
