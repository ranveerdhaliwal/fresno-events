import { describe, expect, it, vi } from "vitest";

import { renderWithProviders, screen, waitFor } from "@/tests/render";

import { AdSenseUnit } from "./AdSenseUnit";
import { loadAdSenseScript } from "@/lib/google-adsense/google-adsense.utils";

vi.mock("@/lib/google-adsense/google-adsense.utils", () => ({
  loadAdSenseScript: vi.fn().mockResolvedValue(undefined),
  pushAdSenseSlot: vi.fn()
}));

const loadAdSenseScriptMock = vi.mocked(loadAdSenseScript);

describe("AdSenseUnit", () => {
  it("renders live ad slot container", () => {
    renderWithProviders(<AdSenseUnit clientId="ca-test" slotId="slot-1" variant="banner-wide" />);
    expect(screen.getByTestId("ad-slot-live-banner-wide")).toBeInTheDocument();
  });

  it("reports unavailable when AdSense marks the slot unfilled", async () => {
    const onUnavailable = vi.fn();
    renderWithProviders(
      <AdSenseUnit
        clientId="ca-test"
        slotId="slot-1"
        variant="banner-wide"
        onUnavailable={onUnavailable}
      />
    );

    const ins = screen.getByTestId("ad-slot-live-banner-wide").querySelector("ins");
    ins?.setAttribute("data-ad-status", "unfilled");

    await waitFor(() => expect(onUnavailable).toHaveBeenCalled());
  });

  it("stays live when AdSense fills the slot", async () => {
    const onUnavailable = vi.fn();
    renderWithProviders(
      <AdSenseUnit
        clientId="ca-test"
        slotId="slot-1"
        variant="banner-wide"
        onUnavailable={onUnavailable}
      />
    );

    const ins = screen.getByTestId("ad-slot-live-banner-wide").querySelector("ins");
    ins?.setAttribute("data-ad-status", "filled");

    await waitFor(() => expect(ins).toHaveAttribute("data-ad-status", "filled"));
    expect(onUnavailable).not.toHaveBeenCalled();
  });

  it("reports unavailable when the AdSense script fails to load", async () => {
    loadAdSenseScriptMock.mockRejectedValueOnce(new Error("blocked"));
    const onUnavailable = vi.fn();

    renderWithProviders(
      <AdSenseUnit
        clientId="ca-test"
        slotId="slot-1"
        variant="banner-wide"
        onUnavailable={onUnavailable}
      />
    );

    await waitFor(() => expect(onUnavailable).toHaveBeenCalled());
  });
});
