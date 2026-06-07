import type { EventCategory, NormalizedEvent } from "@fresno-events/shared";

import configJson from "./venunite.config.json";
import type { VenuniteConfig, VenuniteEvent, VenuniteResponse } from "./venunite.types";
import { VenuniteResponseSchema } from "./venunite.types";

const VENUNITE_API = "https://venunite.com/api/events";

export const venuniteConfig = configJson as VenuniteConfig;

export function shouldSkipModule(sourceModule: string, skipModules: readonly string[]): boolean {
  return skipModules.includes(sourceModule);
}

export function buildVenunitePageUrl(page: number, cfg: VenuniteConfig = venuniteConfig): string {
  const url = new URL(VENUNITE_API);
  url.searchParams.set("state", cfg.state);
  url.searchParams.set("cities", cfg.cities);
  url.searchParams.set("sort", cfg.sort);
  url.searchParams.set("includeFilters", "false");
  url.searchParams.set("page", String(page));
  return url.toString();
}

export function parseVenuniteResponse(payload: unknown): VenuniteResponse {
  return VenuniteResponseSchema.parse(payload);
}

/** Prefer upstream Eventbrite id when present — stable across Venunite slug changes. */
export function resolveSourceEventId(event: VenuniteEvent): string {
  const website = event.website?.trim();
  if (website) {
    const ebMatch = /eventbrite\.com\/e\/[^/?#]*-(\d+)/i.exec(website);
    if (ebMatch?.[1]) {
      return `eb:${ebMatch[1]}`;
    }
    const tmMatch = /ticketmaster\.com\/.*\/event\/([^/?#]+)/i.exec(website);
    if (tmMatch?.[1]) {
      return `tm:${tmMatch[1]}`;
    }
  }
  return `vu:${event.id}`;
}

export function toNormalizedEvent(event: VenuniteEvent): NormalizedEvent | null {
  const venueName = event.venue?.name?.trim();
  if (!venueName || !event.title.trim() || !event.startDate) {
    return null;
  }

  const listingUrl = event.website?.trim() || undefined;
  const minCents = event.priceWatch?.minPriceCents;
  const maxCents = event.priceWatch?.maxPriceCents;

  return {
    source: "venunite",
    sourceEventId: resolveSourceEventId(event),
    title: event.title.trim(),
    venueName,
    startTs: event.startDate,
    timezone: event.timezone ?? "America/Los_Angeles",
    category: mapVenuniteCategory(event.category, event.categories),
    subcategories: event.categories ?? [],
    tags: ["venunite", "api", `upstream:${event.sourceModule}`],
    currency: event.priceWatch?.currency ?? "USD",
    ...(event.endDate ? { endTs: event.endDate } : {}),
    ...(event.cost ? { descriptionText: `Cost: ${event.cost}` } : {}),
    ...(event.venue?.city ? { venueCity: event.venue.city } : { venueCity: "Fresno" }),
    ...(minCents != null && minCents > 0 ? { priceMin: minCents / 100 } : {}),
    ...(maxCents != null && maxCents > 0 ? { priceMax: maxCents / 100 } : {}),
    ...(listingUrl ? { externalUrl: listingUrl, ticketUrl: listingUrl } : {}),
    ...(event.imageUrl ? { imageUrl: event.imageUrl } : {})
  };
}

export function mapVenuniteCategory(
  category: string | null | undefined,
  categories: string[] | undefined
): EventCategory {
  const blob = `${category ?? ""} ${(categories ?? []).join(" ")}`.toLowerCase();
  if (blob.includes("music") || blob.includes("concert")) return "music";
  if (blob.includes("comedy") || blob.includes("open mic")) return "comedy";
  if (blob.includes("theater") || blob.includes("theatre")) return "theater";
  if (blob.includes("sport")) return "sports";
  if (blob.includes("food") || blob.includes("drink")) return "food_drink";
  if (blob.includes("festival")) return "festival";
  if (blob.includes("family")) return "family";
  if (blob.includes("film") || blob.includes("art") || blob.includes("culture")) return "art";
  if (blob.includes("nightlife") || blob.includes("karaoke")) return "nightlife";
  if (blob.includes("outdoor")) return "outdoor";
  if (blob.includes("wellness")) return "wellness";
  if (blob.includes("workshop") || blob.includes("education")) return "education";
  return "community";
}

export function mapVenuniteEvents(
  events: VenuniteEvent[],
  skipModules: readonly string[] = venuniteConfig.skipModules
): NormalizedEvent[] {
  const out: NormalizedEvent[] = [];
  for (const event of events) {
    if (shouldSkipModule(event.sourceModule, skipModules)) {
      continue;
    }
    const mapped = toNormalizedEvent(event);
    if (mapped) {
      out.push(mapped);
    }
  }
  return out;
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
