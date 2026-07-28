import { describe, expect, it, vi } from "vitest";

import { renderWithSiteRouter } from "@/tests/router-render";
import { screen } from "@/tests/render";

import { FeaturedEvents } from "./FeaturedEvents";

const mockState = vi.hoisted(() => ({
  isLoading: false
}));

vi.mock("./useHomepageCuration", () => ({
  useHomepageCuration: () => ({
    isLoading: mockState.isLoading,
    viewModel: mockState.isLoading
      ? null
      : {
          featuredCards: [],
          biggestMonth: [],
          source: "mock",
          generatedAt: "2026-06-10T00:00:00.000Z"
        }
  })
}));

describe("FeaturedEvents", () => {
  it("renders skeleton while loading", async () => {
    mockState.isLoading = true;
    await renderWithSiteRouter(<FeaturedEvents />);
    expect(screen.getByTestId("featured-events-skeleton")).toBeInTheDocument();
    mockState.isLoading = false;
  });

  it("renders featured section with biggest-events list", async () => {
    await renderWithSiteRouter(<FeaturedEvents />);
    expect(screen.getByTestId("featured-events")).toBeInTheDocument();
    expect(screen.getByText("HAPPENING")).toBeInTheDocument();
    expect(screen.getByTestId("popular-list")).toBeInTheDocument();
    expect(screen.getByText("BIGGEST EVENTS THIS MONTH")).toBeInTheDocument();
  });

  it("places biggest-events list in sidebar beside featured grid", async () => {
    await renderWithSiteRouter(<FeaturedEvents />);

    const layout = document.querySelector('[class*="layout"]');
    expect(layout).toBeTruthy();

    const aside = layout?.querySelector("aside");
    expect(aside).toBeTruthy();
    expect(aside?.querySelector('[data-testid="popular-list"]')).toBeTruthy();
    expect(layout?.querySelector('[class*="grid"]')).toBeTruthy();
  });
});
