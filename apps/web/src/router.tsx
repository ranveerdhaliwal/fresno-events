import { createRootRoute, createRoute, createRouter, Outlet, redirect } from "@tanstack/react-router";

import { PlaceholderPage } from "@/components/PlaceholderPage";
import { AdminPage } from "@/pages/AdminPage";
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
  component: () => (
    <PlaceholderPage
      eyebrow="Map"
      title="Clustered events across the Valley."
      description="Mapbox will power custom-styled pins, top filter chips, and a springy bottom sheet of nearby events."
    />
  )
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
  component: () => (
    <PlaceholderPage
      eyebrow="Search"
      title="Fast search for events, venues, and artists."
      description="The search surface will include debounced keystrokes, recents, trending terms, and type filters."
    />
  )
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

const adminRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/admin",
  component: AdminPage
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
  adminRoute
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
