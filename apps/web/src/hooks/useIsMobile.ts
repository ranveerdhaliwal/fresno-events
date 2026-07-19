import { useCallback, useSyncExternalStore } from "react";
import { useNavigate } from "@tanstack/react-router";

/** Matches CSS `@media (max-width: 600px)` used across the web app. */
export const MOBILE_MAX_WIDTH_PX = 600;
export const MOBILE_MEDIA_QUERY = `(max-width: ${MOBILE_MAX_WIDTH_PX}px)`;

/**
 * When the list/detail split collapses to a single column (detail panel hidden).
 * Keep in sync with EventBrowseSplit / DaySchedule / UpcomingEvents CSS (1080px).
 */
export const BROWSE_STACK_MAX_WIDTH_PX = 1080;
export const BROWSE_STACK_MEDIA_QUERY = `(max-width: ${BROWSE_STACK_MAX_WIDTH_PX}px)`;

function subscribeToQuery(query: string, onChange: () => void): () => void {
  const media = window.matchMedia(query);
  media.addEventListener("change", onChange);
  return () => media.removeEventListener("change", onChange);
}

function useMediaQuery(query: string): boolean {
  return useSyncExternalStore(
    (onChange) => subscribeToQuery(query, onChange),
    () => window.matchMedia(query).matches,
    () => false
  );
}

/** True when the viewport is at the mobile breakpoint (≤600px). */
export function useIsMobile(): boolean {
  return useMediaQuery(MOBILE_MEDIA_QUERY);
}

/** True when browse list/detail is stacked and the detail panel is hidden (≤1080px). */
export function useIsBrowseStack(): boolean {
  return useMediaQuery(BROWSE_STACK_MEDIA_QUERY);
}

export interface UseBrowseEventSelectOptions {
  /** Desktop split: keep selection in-page. */
  onSelectInSplit: (id: string) => void;
  /** Stacked layout: open the event detail route (defaults to in-app navigate). */
  onOpenEvent?: (slug: string) => void;
}

/**
 * Shared list click behavior: open detail when the split detail pane is hidden,
 * otherwise update in-page selection.
 */
export function useBrowseEventSelect({
  onSelectInSplit,
  onOpenEvent
}: UseBrowseEventSelectOptions): (id: string, slug: string) => void {
  const isStack = useIsBrowseStack();
  const navigate = useNavigate();

  return useCallback(
    (id: string, slug: string) => {
      if (isStack) {
        if (onOpenEvent) {
          onOpenEvent(slug);
          return;
        }
        void navigate({ to: "/event/$slug", params: { slug } });
        return;
      }
      onSelectInSplit(id);
    },
    [isStack, navigate, onOpenEvent, onSelectInSplit]
  );
}
