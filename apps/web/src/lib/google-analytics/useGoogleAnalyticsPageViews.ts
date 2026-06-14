import { useRouterState } from "@tanstack/react-router";
import { useEffect, useRef } from "react";

import { isGoogleAnalyticsEnabled, shouldTrackPath, trackPageView } from "./google-analytics.utils";

export function useGoogleAnalyticsPageViews(): void {
  const { pathname, searchStr } = useRouterState({ select: (state) => state.location });
  const lastTrackedRef = useRef<string | null>(null);

  useEffect(() => {
    if (!isGoogleAnalyticsEnabled() || !shouldTrackPath(pathname)) {
      return;
    }

    const key = `${pathname}${searchStr}`;
    if (lastTrackedRef.current === key) {
      return;
    }

    lastTrackedRef.current = key;
    trackPageView(pathname, searchStr);
  }, [pathname, searchStr]);
}
