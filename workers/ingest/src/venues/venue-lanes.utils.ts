import type { VenueConfig, VenueIngestLane, VenueStrategy } from "@/venues/venue.types";

/** Promote uses Browser Rendering + LLM on listing/detail pages. */
export const BROWSER_RENDERING_STRATEGIES = new Set<VenueStrategy>([
  "listing_then_detail",
  "month_windows_then_detail",
  "scroll_listing_then_detail"
]);

export function venueIngestLane(config: Pick<VenueConfig, "strategy" | "ingestLane">): VenueIngestLane {
  if (config.ingestLane) {
    return config.ingestLane;
  }
  return BROWSER_RENDERING_STRATEGIES.has(config.strategy) ? "browser" : "direct";
}

export function filterVenuesByLane(configs: VenueConfig[], lane: VenueIngestLane): VenueConfig[] {
  return configs.filter((config) => config.enabled && venueIngestLane(config) === lane);
}

export function venueKeysByLane(configs: VenueConfig[], lane: VenueIngestLane): string[] {
  return filterVenuesByLane(configs, lane)
    .map((config) => config.key)
    .sort((a, b) => a.localeCompare(b));
}

export type { VenueIngestLane };
