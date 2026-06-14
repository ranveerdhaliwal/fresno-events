import { createMemoryHistory, createRootRoute, createRoute, createRouter, RouterProvider } from "@tanstack/react-router";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { CalendarDayTile } from "./CalendarDayTile";

describe("CalendarDayTile", () => {
  it("renders date in top-left style block", async () => {
    const rootRoute = createRootRoute();
    const dayRoute = createRoute({
      getParentRoute: () => rootRoute,
      path: "/day/$date",
      component: () => (
        <CalendarDayTile
          isoDate="2026-06-05"
          preview={[]}
          hidden={0}
          total={0}
          inMonth
          isToday
          isWeekend={false}
        />
      )
    });
    const router = createRouter({
      routeTree: rootRoute.addChildren([dayRoute]),
      history: createMemoryHistory({ initialEntries: ["/day/2026-06-05"] })
    });
    await router.load();
    render(<RouterProvider router={router} />);

    expect(screen.getByText("FRI")).toBeInTheDocument();
    expect(screen.getByText("05")).toBeInTheDocument();
    expect(screen.getByTestId("calendar-day-2026-06-05")).toHaveClass(/today/);
  });
});
