import { describe, expect, it, vi } from "vitest";

import { createMemoryHistory, createRootRoute, createRoute, createRouter, RouterProvider } from "@tanstack/react-router";
import { render, screen } from "@testing-library/react";

import { RootLayout } from "./RootLayout";

vi.mock("@/lib/google-analytics/useGoogleAnalyticsPageViews", () => ({
  useGoogleAnalyticsPageViews: vi.fn()
}));

describe("RootLayout", () => {
  it("renders outlet content", async () => {
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
  });
});
