import { Outlet, useRouterState } from "@tanstack/react-router";

import { HomeAtmosphere } from "@/components/HomeAtmosphere";
import { useGoogleAnalyticsPageViews } from "@/lib/google-analytics/useGoogleAnalyticsPageViews";

export function RootLayout() {
  useGoogleAnalyticsPageViews();
  const isAdmin = useRouterState({
    select: (state) => state.location.pathname.startsWith("/admin")
  });

  return (
    <>
      {!isAdmin ? <HomeAtmosphere /> : null}
      <Outlet />
    </>
  );
}
