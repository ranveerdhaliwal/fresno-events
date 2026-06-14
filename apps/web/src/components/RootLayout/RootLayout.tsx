import { Outlet } from "@tanstack/react-router";

import { useGoogleAnalyticsPageViews } from "@/lib/google-analytics/useGoogleAnalyticsPageViews";

export function RootLayout() {
  useGoogleAnalyticsPageViews();
  return <Outlet />;
}
