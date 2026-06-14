import { eventCategories, type EventCategory, type NormalizedEvent } from "@fresno-events/shared";

import type { AiDiscoveryItem } from "@/ai";
import { hashSync } from "@/ai/hash";

const ALLOWED_CATEGORIES: ReadonlySet<string> = new Set(eventCategories);

export interface DiscoveryNormalizeExtras {
  seriesId?: string;
  seriesName?: string;
  lineup?: NormalizedEvent["lineup"];
}

export function toNormalizedEventFromDiscovery(
  item: AiDiscoveryItem,
  pageUrl: string,
  seedUrl: string,
  tag: "venue-ingest",
  extras: DiscoveryNormalizeExtras = {}
): NormalizedEvent | null {
  if (!item.title.trim() || !item.venueName.trim() || !item.startTs) {
    return null;
  }

  const start = new Date(item.startTs);
  if (Number.isNaN(start.getTime())) {
    return null;
  }

  const host = new URL(seedUrl).hostname.replace(/^www\./, "");
  const category = ALLOWED_CATEGORIES.has(item.category as EventCategory)
    ? (item.category as EventCategory)
    : "community";
  const startIso = start.toISOString();

  return {
    source: `scrape:${host}`,
    sourceEventId: `ai:${hashSync(`${item.title}|${item.venueName}|${startIso}|${pageUrl}`)}`,
    title: item.title.trim(),
    venueName: item.venueName.trim(),
    startTs: startIso,
    timezone: "America/Los_Angeles",
    category,
    subcategories: [],
    tags: [tag],
    currency: "USD",
    ...(item.descriptionText ? { descriptionText: item.descriptionText } : {}),
    ...(item.venueAddress ? { venueAddress: item.venueAddress } : {}),
    ...(item.venueCity ? { venueCity: item.venueCity } : { venueCity: "Fresno" }),
    ...(typeof item.priceMin === "number" ? { priceMin: item.priceMin } : {}),
    ...(typeof item.priceMax === "number" ? { priceMax: item.priceMax } : {}),
    externalUrl: item.externalUrl ?? pageUrl,
    ...(item.ticketUrl ? { ticketUrl: item.ticketUrl } : {}),
    ...(item.imageUrl ? { imageUrl: item.imageUrl } : {}),
    ...(extras.seriesId ? { seriesId: extras.seriesId } : {}),
    ...(extras.seriesName ? { seriesName: extras.seriesName } : {}),
    ...(extras.lineup ? { lineup: extras.lineup } : {})
  };
}
