import { createRootRoute, createRoute, createRouter, redirect, useSearch } from "@tanstack/react-router";

import { RootLayout } from "@/components/RootLayout";
import { EventMapPage } from "@/features/event-map/EventMapPage";
import { SearchPage } from "@/features/search/SearchPage";
import { PlaceholderPage } from "@/components/PlaceholderPage";
import { AdminLayoutPage } from "@/pages/AdminLayoutPage";
import { AdminEventsPage } from "@/pages/AdminEventsPage";
import { AdminHomepagePage } from "@/pages/AdminHomepagePage";
import { AdminEventEditorPage } from "@/pages/AdminEventEditorPage";
import { AdminReviewPage } from "@/pages/AdminReviewPage";
import { CalendarPage } from "@/pages/CalendarPage/CalendarPage";
import { DayPage } from "@/pages/DayPage";
import { EventDetailPage } from "@/pages/EventDetailPage";
import { HomePage } from "@/pages/HomePage";
import { PrivacyPage } from "@/pages/PrivacyPage";
import { SeriesPage } from "@/pages/SeriesPage/SeriesPage";
import { VenuePage } from "@/pages/VenuePage/VenuePage";
import { queryClient } from "@/lib/query-client";
import { pacificTodayIso } from "@fresno-events/shared";

const rootRoute = createRootRoute({
  component: RootLayout
});

const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/",
  component: HomePage
});

const calendarRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/calendar",
  validateSearch: (search: Record<string, unknown>) => {
    const today = pacificTodayIso();
    const [defaultYear, defaultMonth] = today.split("-").map(Number);
    const year = Number(search.year);
    const month = Number(search.month);
    return {
      year: Number.isInteger(year) && year > 2000 ? year : defaultYear!,
      month: Number.isInteger(month) && month >= 1 && month <= 12 ? month : defaultMonth!
    };
  },
  component: function CalendarRoute() {
    const { year, month } = useSearch({ from: "/calendar" });
    return <CalendarPage year={year} month={month} />;
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
  beforeLoad: () => {
    throw redirect({ to: "/search", search: { q: "" } });
  }
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

const seriesRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/series/$seriesId",
  component: SeriesPage
});

const venueRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/venue/$slug",
  component: VenuePage
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

const privacyRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/privacy",
  component: PrivacyPage
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
  seriesRoute,
  venueRoute,
  artistRoute,
  searchRoute,
  savedRoute,
  settingsRoute,
  privacyRoute,
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
