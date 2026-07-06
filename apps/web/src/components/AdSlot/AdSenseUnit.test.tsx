import { describe, expect, it, vi } from "vitest";

import { renderWithProviders, screen } from "@/tests/render";

import { AdSenseUnit } from "./AdSenseUnit";

vi.mock("@/lib/google-adsense/google-adsense.utils", () => ({
  loadAdSenseScript: vi.fn().mockResolvedValue(undefined),
  pushAdSenseSlot: vi.fn()
}));

describe("AdSenseUnit", () => {
  it("renders live ad slot container", () => {
    renderWithProviders(<AdSenseUnit clientId="ca-test" slotId="slot-1" variant="banner-wide" />);
    expect(screen.getByTestId("ad-slot-live-banner-wide")).toBeInTheDocument();
  });
});
