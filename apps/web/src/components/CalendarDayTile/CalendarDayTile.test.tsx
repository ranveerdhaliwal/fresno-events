import { createMemoryHistory, createRootRoute, createRoute, createRouter, RouterProvider } from "@tanstack/react-router";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { EventListItem } from "@fresno-events/shared";

import { CalendarDayTile } from "./CalendarDayTile";

function stubItem(id: string, title: string): EventListItem {
  return {
    event: {
      id,
      slug: id,
      title,
      category: "music",
      tags: [],
      subcategories: [],
      status: "published",
      startTs: "2026-08-15T20:00:00.000Z",
      venueId: "v1",
      timezone: "America/Los_Angeles",
      source: "manual",
      sourceRefs: {},
      currency: "USD",
      galleryImageIds: [],
      allArtistIds: [],
      priority: 3,
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z"
    },
    venue: {
      id: "v1",
      slug: "venue",
      name: "Venue",
      city: "Fresno",
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z"
    }
  } as unknown as EventListItem;
}

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
    expect(screen.getByTestId("calendar-day-2026-06-05")).not.toHaveAttribute("aria-label");
  });

  it("collapses same-name previews into one labeled row", async () => {
    const rootRoute = createRootRoute();
    const dayRoute = createRoute({
      getParentRoute: () => rootRoute,
      path: "/day/$date",
      component: () => (
        <CalendarDayTile
          isoDate="2026-08-15"
          preview={[
            stubItem("a", "Jason Aldean"),
            stubItem("b", "Jason Aldean"),
            stubItem("c", "ZZ Top")
          ]}
          hidden={2}
          total={5}
          inMonth
          isToday={false}
          isWeekend
        />
      )
    });
    const router = createRouter({
      routeTree: rootRoute.addChildren([dayRoute]),
      history: createMemoryHistory({ initialEntries: ["/day/2026-08-15"] })
    });
    await router.load();
    render(<RouterProvider router={router} />);

    expect(screen.getByText(/Jason Aldean/)).toBeInTheDocument();
    expect(screen.getByText("×2")).toBeInTheDocument();
    expect(screen.getByText("ZZ Top")).toBeInTheDocument();
    expect(screen.getByText("+2 more →")).toBeInTheDocument();
  });
});
