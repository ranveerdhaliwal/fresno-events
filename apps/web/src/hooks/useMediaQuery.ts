import { useSyncExternalStore } from "react";

function subscribeToQuery(query: string, onChange: () => void): () => void {
  const media = window.matchMedia(query);
  media.addEventListener("change", onChange);
  return () => media.removeEventListener("change", onChange);
}

/** Tracks a CSS media query's match state, updating on viewport changes. SSR-safe (defaults to false). */
export function useMediaQuery(query: string): boolean {
  return useSyncExternalStore(
    (onChange) => subscribeToQuery(query, onChange),
    () => window.matchMedia(query).matches,
    () => false
  );
}
