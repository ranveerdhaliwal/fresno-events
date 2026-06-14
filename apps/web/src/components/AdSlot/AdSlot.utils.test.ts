import { describe, expect, it, vi } from "vitest";

import { isAdSenseLive } from "./AdSlot.utils";

describe("AdSlot.utils", () => {
  it("is disabled when client or slot env is missing", () => {
    vi.stubEnv("VITE_ADSENSE_CLIENT_ID", "");
    vi.stubEnv("VITE_ADSENSE_SLOT_BANNER_WIDE", "");
    expect(isAdSenseLive("banner-wide")).toBe(false);

    vi.stubEnv("VITE_ADSENSE_CLIENT_ID", "ca-pub-test");
    vi.stubEnv("VITE_ADSENSE_SLOT_BANNER_WIDE", "");
    expect(isAdSenseLive("banner-wide")).toBe(false);

    vi.stubEnv("VITE_ADSENSE_CLIENT_ID", "ca-pub-test");
    vi.stubEnv("VITE_ADSENSE_SLOT_CARD", "12345");
    expect(isAdSenseLive("card")).toBe(true);
  });
});
