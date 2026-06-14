import { describe, expect, it, vi } from "vitest";

import { isGoogleAnalyticsEnabled, shouldTrackPath } from "./google-analytics.utils";

describe("google-analytics.utils", () => {
  it("shouldTrackPath excludes admin routes", () => {
    expect(shouldTrackPath("/")).toBe(true);
    expect(shouldTrackPath("/event/foo")).toBe(true);
    expect(shouldTrackPath("/admin")).toBe(false);
    expect(shouldTrackPath("/admin/events")).toBe(false);
  });

  it("isGoogleAnalyticsEnabled requires measurement id", () => {
    vi.stubEnv("VITE_GA_MEASUREMENT_ID", "");
    expect(isGoogleAnalyticsEnabled()).toBe(false);

    vi.stubEnv("VITE_GA_MEASUREMENT_ID", "G-TEST123");
    expect(isGoogleAnalyticsEnabled()).toBe(true);
  });
});
