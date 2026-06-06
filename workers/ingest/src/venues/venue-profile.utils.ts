import type { VenueConfig, VenueStrategy } from "@/venues/venue.types";

export type ListingDiscoveryMode = "plain" | "br_if_empty";
export type DetailMode = "none" | "plain_html" | "br_llm" | "api_embedded";

export function resolveListingDiscovery(config: VenueConfig): ListingDiscoveryMode {
  if (config.listingDiscovery) {
    return config.listingDiscovery;
  }
  if (config.strategy === "month_windows_then_detail" || config.strategy === "scroll_listing_then_detail") {
    return "br_if_empty";
  }
  return "plain";
}

export function resolveDetailMode(config: VenueConfig): DetailMode {
  if (config.detailMode) {
    return config.detailMode;
  }
  if (config.strategy === "api") {
    return "api_embedded";
  }
  return "br_llm";
}

export function isDetailHostBlocked(url: string, config: VenueConfig): boolean {
  const blocked = config.blockedDetailHosts ?? [];
  if (blocked.length === 0) {
    return false;
  }
  try {
    const host = new URL(url).hostname.replace(/^www\./, "");
    return blocked.some((entry) => {
      const normalized = entry.replace(/^www\./, "");
      return host === normalized || host.endsWith(`.${normalized}`);
    });
  } catch {
    return true;
  }
}

export function strategyUsesBrowserListing(strategy: VenueStrategy): boolean {
  return (
    strategy === "month_windows_then_detail" ||
    strategy === "scroll_listing_then_detail"
  );
}
