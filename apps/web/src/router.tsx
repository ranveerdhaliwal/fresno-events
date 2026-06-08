import { createRootRoute, createRoute, createRouter, Outlet, redirect } from "@tanstack/react-router";

import { EventMapPage } from "@/features/event-map/EventMapPage";
import { SearchPage } from "@/features/search/SearchPage";
import { PlaceholderPage } from "@/components/PlaceholderPage";
import { AdminLayoutPage } from "@/pages/AdminLayoutPage";
import { AdminEventsPage } from "@/pages/AdminEventsPage";
import { AdminHomepagePage } from "@/pages/AdminHomepagePage";
import { AdminEventEditorPage } from "@/pages/AdminEventEditorPage";
import { AdminReviewPage } from "@/pages/AdminReviewPage";
import { DayPage } from "@/pages/DayPage";
import { EventDetailPage } from "@/pages/EventDetailPage";
import { HomePage } from "@/pages/HomePage";
import { queryClient } from "@/lib/query-client";
import { toIsoDateLocal } from "@/lib/event-time";

const rootRoute = createRootRoute({
  component: () => <Outlet />
});

const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/",
  component: HomePage
});

const calendarRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/calendar",
  beforeLoad: () => {
    throw redirect({ to: "/day/$date", params: { date: toIsoDateLocal(new Date()) } });
  }
});

const dayRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/day/$date",
  component: DayPage
});

const exploreRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/explore",
  component: () => (
    <PlaceholderPage
      eyebrow="Explore"
      title="Filters with personality, not clutter."
      description="Date range, neighborhood, category, price, free-only, venue, and sort controls will live behind a mobile-first filter sheet."
    />
  )
});

const mapRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/map",
  component: EventMapPage
});

const eventRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/event/$slug",
  component: EventDetailPage
});

const venueRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/venue/$slug",
  component: () => (
    <PlaceholderPage
      eyebrow="Venue"
      title="Every venue gets a proper stage."
      description="Venue pages will include upcoming events, location details, hero imagery, and related places."
    />
  )
});

const artistRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/artist/$slug",
  component: () => (
    <PlaceholderPage
      eyebrow="Artist"
      title="Fresno dates, genres, and context."
      description="Artist pages will connect upcoming local appearances with bios, genre metadata, and music embeds."
    />
  )
});

const searchRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/search",
  validateSearch: (search: Record<string, unknown>) => ({
    q: typeof search.q === "string" ? search.q : ""
  }),
  component: SearchPage
});

const savedRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/saved",
  component: () => (
    <PlaceholderPage
      eyebrow="Saved"
      title="Your Fresno calendar."
      description="Saved events start device-local for anonymous users and later sync with Supabase Auth accounts."
    />
  )
});

const settingsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/settings",
  component: () => (
    <PlaceholderPage
      eyebrow="Settings"
      title="Notifications, digest, and appearance."
      description="Users will manage category, venue, artist, weekly digest, and notification preferences here."
    />
  )
});

const adminLayoutRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/admin",
  component: AdminLayoutPage
});

const adminIndexRoute = createRoute({
  getParentRoute: () => adminLayoutRoute,
  path: "/",
  component: AdminReviewPage
});

const adminHomepageRoute = createRoute({
  getParentRoute: () => adminLayoutRoute,
  path: "/homepage",
  component: AdminHomepagePage
});

const adminEventsListRoute = createRoute({
  getParentRoute: () => adminLayoutRoute,
  path: "/events",
  component: AdminEventsPage
});

const adminEventEditorRoute = createRoute({
  getParentRoute: () => adminLayoutRoute,
  path: "/events/$eventId",
  component: AdminEventEditorPage
});

const routeTree = rootRoute.addChildren([
  indexRoute,
  calendarRoute,
  dayRoute,
  exploreRoute,
  mapRoute,
  eventRoute,
  venueRoute,
  artistRoute,
  searchRoute,
  savedRoute,
  settingsRoute,
  adminLayoutRoute.addChildren([adminIndexRoute, adminEventsListRoute, adminHomepageRoute, adminEventEditorRoute])
]);

export const router = createRouter({
  routeTree,
  context: { queryClient },
  defaultPreload: "intent",
  scrollRestoration: true
});

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}
