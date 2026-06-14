import { createMemoryHistory, createRootRoute, createRoute, createRouter, RouterProvider } from "@tanstack/react-router";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { SiteFooter } from "./SiteFooter";

async function renderFooter() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } }
  });
  const rootRoute = createRootRoute({ component: SiteFooter });
  const indexRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: "/",
    component: SiteFooter
  });
  const privacyRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: "/privacy",
    component: () => <div>Privacy</div>
  });
  const router = createRouter({
    routeTree: rootRoute.addChildren([indexRoute, privacyRoute]),
    history: createMemoryHistory({ initialEntries: ["/"] })
  });

  const view = render(
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  );

  await router.load();
  return { router, view };
}

describe("SiteFooter", () => {
  it("renders privacy policy link", async () => {
    await renderFooter();
    expect(screen.getByRole("link", { name: "Privacy Policy" })).toHaveAttribute("href", "/privacy");
  });
});
