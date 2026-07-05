import {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  Outlet,
  RouterProvider
} from "@tanstack/react-router";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, type RenderOptions } from "@testing-library/react";
import type { ReactElement, ReactNode } from "react";

function createTestQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
      mutations: { retry: false }
    }
  });
}

export interface RenderWithSiteRouterOptions extends Omit<RenderOptions, "wrapper"> {
  initialPath?: string;
  queryClient?: QueryClient;
}

/** Router tree with common public routes for component tests that use Link. */
export async function renderWithSiteRouter(ui: ReactElement, options: RenderWithSiteRouterOptions = {}) {
  const queryClient = options.queryClient ?? createTestQueryClient();
  const initialPath = options.initialPath ?? "/";

  const rootRoute = createRootRoute({ component: () => <Outlet /> });
  const indexRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: "/",
    component: () => ui
  });
  const searchRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: "/search",
    validateSearch: (search: Record<string, unknown>) => ({
      q: typeof search.q === "string" ? search.q : ""
    }),
    component: () => null
  });
  const mapRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: "/map",
    component: () => null
  });
  const calendarRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: "/calendar",
    validateSearch: (search: Record<string, unknown>) => ({
      year: typeof search.year === "number" ? search.year : new Date().getFullYear(),
      month: typeof search.month === "number" ? search.month : new Date().getMonth() + 1
    }),
    component: () => null
  });
  const dayRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: "/day/$date",
    component: () => null
  });
  const eventRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: "/event/$slug",
    component: () => null
  });
  const privacyRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: "/privacy",
    component: () => null
  });
  const venueRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: "/venue/$slug",
    component: () => null
  });
  const adminRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: "/admin",
    component: () => ui
  });
  const adminEventsRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: "/admin/events/$eventId",
    component: () => null
  });

  const router = createRouter({
    routeTree: rootRoute.addChildren([
      indexRoute,
      searchRoute,
      mapRoute,
      calendarRoute,
      dayRoute,
      eventRoute,
      privacyRoute,
      venueRoute,
      adminRoute,
      adminEventsRoute
    ]),
    history: createMemoryHistory({ initialEntries: [initialPath] }),
    context: { queryClient }
  });

  function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  }

  const view = render(
    <Wrapper>
      <RouterProvider router={router} />
    </Wrapper>,
    options
  );

  await router.load();

  return { ...view, router, queryClient };
}
