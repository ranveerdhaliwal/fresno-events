import {
  type EventCategory,
  isValidCoordinate,
  type NormalizedEvent,
  parseStreetFromFullAddress
} from "@fresno-events/shared";

import configJson from "./venunite.config.json";
import {
  buildVenuniteTags,
  detailVenueToVenueDetail,
  mergeVenuniteDetailFields,
  resolveVenuniteDescriptionText
} from "./venunite-detail.utils";
import type {
  VenuniteConfig,
  VenuniteEvent,
  VenuniteEventDetail,
  VenuniteResponse,
  VenuniteVenueDetail
} from "./venunite.types";
import { VenuniteResponseSchema } from "./venunite.types";

const VENUNITE_API = "https://venunite.com/api/events";

export const venuniteConfig = configJson as VenuniteConfig;

export function shouldSkipModule(sourceModule: string, skipModules: readonly string[]): boolean {
  return skipModules.includes(sourceModule);
}

export function shouldSkipVenue(
  event: VenuniteEvent,
  cfg: Pick<VenuniteConfig, "skipVenueSlugs" | "skipVenueNameIncludes"> = venuniteConfig
): boolean {
  const slug = event.venue?.slug?.trim().toLowerCase();
  if (slug && (cfg.skipVenueSlugs ?? []).some((s) => s.toLowerCase() === slug)) {
    return true;
  }

  const venueName = event.venue?.name?.trim().toLowerCase() ?? "";
  if (venueName && (cfg.skipVenueNameIncludes ?? []).some((needle) => venueName.includes(needle.toLowerCase()))) {
    return true;
  }

  return false;
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

export function resolveVenuniteVenueLocation(
  event: VenuniteEvent,
  venueDetail?: VenuniteVenueDetail | null
): Pick<NormalizedEvent, "venueAddress" | "venueCity" | "venueLat" | "venueLng"> {
  const city = venueDetail?.city?.trim() ?? event.venue?.city?.trim() ?? "Fresno";
  const state = venueDetail?.state?.trim() ?? event.venue?.state?.trim() ?? undefined;
  const zip = venueDetail?.zip?.trim();

  const lat = event.venue?.latitude ?? venueDetail?.latitude ?? undefined;
  const lng = event.venue?.longitude ?? venueDetail?.longitude ?? undefined;

  const fullAddress = venueDetail?.address?.trim();
  const venueAddress = fullAddress
    ? parseStreetFromFullAddress(fullAddress, { city, state, zip })
    : undefined;

  return {
    venueCity: city,
    ...(venueAddress ? { venueAddress } : {}),
    ...(isValidCoordinate(lat) ? { venueLat: lat } : {}),
    ...(isValidCoordinate(lng) ? { venueLng: lng } : {})
  };
}

export function toNormalizedEvent(
  event: VenuniteEvent,
  venueDetails: ReadonlyMap<number, VenuniteVenueDetail> = new Map(),
  eventDetail?: VenuniteEventDetail | null
): NormalizedEvent | null {
  const venueName = event.venue?.name?.trim();
  if (!venueName || !event.title.trim() || !event.startDate) {
    return null;
  }

  const listingUrl = event.website?.trim() || undefined;
  const minCents = event.priceWatch?.minPriceCents;
  const maxCents = event.priceWatch?.maxPriceCents;
  const embeddedVenue = eventDetail ? detailVenueToVenueDetail(eventDetail) : undefined;
  const venueDetail =
    embeddedVenue ?? (event.venueId != null ? venueDetails.get(event.venueId) : undefined);
  const descriptionText = resolveVenuniteDescriptionText(event, eventDetail);

  const listing: NormalizedEvent = {
    source: "venunite",
    sourceEventId: resolveSourceEventId(event),
    title: event.title.trim(),
    venueName: embeddedVenue?.name?.trim() || venueName,
    startTs: event.startDate,
    timezone: eventDetail?.timezone ?? event.timezone ?? "America/Los_Angeles",
    category: mapVenuniteCategory(eventDetail?.category ?? event.category, eventDetail?.categories ?? event.categories),
    subcategories: eventDetail?.categories ?? event.categories ?? [],
    tags: buildVenuniteTags(event, eventDetail),
    currency: eventDetail?.priceWatch?.currency ?? event.priceWatch?.currency ?? "USD",
    ...resolveVenuniteVenueLocation(event, venueDetail),
    ...(eventDetail?.endDate || event.endDate ? { endTs: eventDetail?.endDate ?? event.endDate } : {}),
    ...(descriptionText ? { descriptionText } : {}),
    ...(minCents != null && minCents > 0 ? { priceMin: minCents / 100 } : {}),
    ...(maxCents != null && maxCents > 0 ? { priceMax: maxCents / 100 } : {}),
    ...(listingUrl ? { externalUrl: listingUrl, ticketUrl: listingUrl } : {}),
    ...(event.imageUrl ? { imageUrl: event.imageUrl } : {})
  };

  return mergeVenuniteDetailFields(listing, event, eventDetail);
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
  skipModules: readonly string[] = venuniteConfig.skipModules,
  venueDetails: ReadonlyMap<number, VenuniteVenueDetail> = new Map(),
  eventDetails: ReadonlyMap<string, VenuniteEventDetail> = new Map()
): NormalizedEvent[] {
  const out: NormalizedEvent[] = [];
  for (const event of events) {
    if (shouldSkipModule(event.sourceModule, skipModules)) {
      continue;
    }
    if (shouldSkipVenue(event)) {
      continue;
    }
    const mapped = toNormalizedEvent(event, venueDetails, eventDetails.get(event.slug));
    if (mapped) {
      out.push(mapped);
    }
  }
  return out;
}

export { sleep } from "@/lib/sleep";
