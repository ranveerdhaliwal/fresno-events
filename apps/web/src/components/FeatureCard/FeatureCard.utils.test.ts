import { describe, expect, it } from "vitest";

import { formatFeaturedBadgeLabel, shouldShowFeaturedBadge } from "./FeatureCard.utils";

describe("FeatureCard.utils", () => {
  it("hides default badge", () => {
    expect(shouldShowFeaturedBadge("default")).toBe(false);
    expect(shouldShowFeaturedBadge("tonight")).toBe(true);
    expect(shouldShowFeaturedBadge("weekend")).toBe(true);
  });

  it("formats badge label", () => {
    expect(formatFeaturedBadgeLabel("tonight")).toBe("TONIGHT");
    expect(formatFeaturedBadgeLabel("weekend")).toBe("WEEKEND");
  });
});
