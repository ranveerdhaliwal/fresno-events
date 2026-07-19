import { describe, expect, it, vi } from "vitest";

import { renderWithSiteRouter } from "@/tests/router-render";
import { screen } from "@/tests/render";

import { HomeAtmosphere } from "./HomeAtmosphere";

vi.mock("@/lib/home-atmosphere", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/home-atmosphere")>();
  return {
    ...actual,
    HOME_ATMOSPHERE: "veiled-sierra" as const,
    pickAtmosphereVariant: () => actual.HOME_ATMOSPHERE_PACK[0]!
  };
});

describe("HomeAtmosphere", () => {
  it("renders the atmosphere layer with a desktop image by default", async () => {
    Object.defineProperty(window, "innerWidth", { configurable: true, value: 1200 });
    window.matchMedia = vi.fn().mockImplementation((query: string) => ({
      matches: false,
      media: query,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
      onchange: null
    }));

    await renderWithSiteRouter(<HomeAtmosphere />);

    const root = screen.getByTestId("home-atmosphere");
    expect(root).toBeInTheDocument();
    const photo = root.querySelector("[data-atmosphere-image]");
    expect(photo).toHaveAttribute("data-atmosphere-image", "/atmosphere/snow-yosemite.jpg");
    expect(photo).toHaveAttribute("data-atmosphere-id", "snow-yosemite");
  });

  it("serves the mobile -sm asset under the mobile breakpoint", async () => {
    Object.defineProperty(window, "innerWidth", { configurable: true, value: 390 });
    window.matchMedia = vi.fn().mockImplementation((query: string) => ({
      matches: query.includes("768"),
      media: query,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
      onchange: null
    }));

    await renderWithSiteRouter(<HomeAtmosphere />);

    const photo = screen.getByTestId("home-atmosphere").querySelector("[data-atmosphere-image]");
    expect(photo).toHaveAttribute("data-atmosphere-image", "/atmosphere/snow-yosemite-sm.jpg");
  });
});
