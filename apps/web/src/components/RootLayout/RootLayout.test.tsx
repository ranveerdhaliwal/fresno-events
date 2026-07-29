import { describe, expect, it, vi } from "vitest";

import { createMemoryHistory, createRootRoute, createRoute, createRouter, RouterProvider } from "@tanstack/react-router";
import { render, screen } from "@testing-library/react";

import { RootLayout } from "./RootLayout";

vi.mock("@/lib/google-analytics/useGoogleAnalyticsPageViews", () => ({
  useGoogleAnalyticsPageViews: vi.fn()
}));

vi.mock("@/lib/home-atmosphere", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/home-atmosphere")>();
  return {
    ...actual,
    HOME_ATMOSPHERE: "veiled-sierra" as const,
    pickAtmosphereVariant: () => actual.HOME_ATMOSPHERE_PACK[0]!
  };
});

describe("RootLayout", () => {
  it("renders outlet content with atmosphere on public routes", async () => {
    const rootRoute = createRootRoute({ component: RootLayout });
    const indexRoute = createRoute({
      getParentRoute: () => rootRoute,
      path: "/",
      component: () => <div data-testid="outlet-child">Outlet</div>
    });
    const router = createRouter({
      routeTree: rootRoute.addChildren([indexRoute]),
      history: createMemoryHistory({ initialEntries: ["/"] })
    });

    render(<RouterProvider router={router} />);
    await router.load();

    expect(screen.getByTestId("outlet-child")).toHaveTextContent("Outlet");
    expect(screen.getByTestId("home-atmosphere")).toBeInTheDocument();
  });
});
