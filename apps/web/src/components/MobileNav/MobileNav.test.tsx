import { createMemoryHistory, createRootRoute, createRoute, createRouter, Outlet, RouterProvider } from "@tanstack/react-router";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { MobileNav } from "./MobileNav";

function renderMobileNav() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } }
  });
  const rootRoute = createRootRoute({ component: () => <Outlet /> });
  const indexRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: "/",
    component: () => <MobileNav variant="home" />
  });
  const searchRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: "/search",
    validateSearch: (search: Record<string, unknown>) => ({
      q: typeof search.q === "string" ? search.q : ""
    }),
    component: () => null
  });
  const exploreRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: "/explore",
    component: () => null
  });
  const mapRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: "/map",
    component: () => null
  });
  const savedRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: "/saved",
    component: () => null
  });
  const router = createRouter({
    routeTree: rootRoute.addChildren([indexRoute, searchRoute, exploreRoute, mapRoute, savedRoute]),
    history: createMemoryHistory({ initialEntries: ["/"] })
  });

  return {
    router,
    view: render(
      <QueryClientProvider client={queryClient}>
        <RouterProvider router={router} />
      </QueryClientProvider>
    )
  };
}

describe("MobileNav", () => {
  it("opens the menu drawer from the home hamburger button", async () => {
    const { router } = renderMobileNav();
    await router.load();

    expect(screen.queryByTestId("mobile-nav-menu")).not.toBeInTheDocument();

    await screen.getByRole("button", { name: "Open menu" }).click();

    expect(screen.getByTestId("mobile-nav-menu")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "EVENTS" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "SEARCH" })).toBeInTheDocument();
  });
});
