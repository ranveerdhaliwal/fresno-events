import type { NormalizedEvent, ScrapeError } from "@fresno-events/shared";

import type { VenuniteEvent, VenuniteEventDetail, VenuniteVenueDetail } from "./venunite.types";
import { VenuniteEventDetailSchema } from "./venunite.types";
import {
  applyVenuniteFreeAdmissionFields,
  resolveVenunitePriceFields
} from "./venunite-price.utils";
import { shouldSkipModule, shouldSkipVenue, sleep } from "./venunite.utils";

const VENUNITE_EVENT_DETAIL_API = "https://venunite.com/api/events";

export interface LoadVenuniteEventDetailsOptions {
  userAgent: string;
  signal?: AbortSignal;
  delayMs?: number;
  fetchImpl?: typeof fetch;
  onFetched?: (slug: string) => void;
}

export function buildVenuniteEventDetailApiUrl(slug: string): string {
  return `${VENUNITE_EVENT_DETAIL_API}/${encodeURIComponent(slug)}`;
}

export function buildVenuniteEventPublicUrl(slug: string): string {
  return `https://venunite.com/events/${encodeURIComponent(slug)}`;
}

export function parseVenuniteEventDetail(payload: unknown): VenuniteEventDetail | null {
  if (payload == null || typeof payload !== "object") {
    return null;
  }
  if ("error" in payload && typeof (payload as { error?: unknown }).error === "string") {
    return null;
  }
  return VenuniteEventDetailSchema.parse(payload);
}

export function collectVenuniteEventSlugs(
  events: VenuniteEvent[],
  skipModules: readonly string[]
): string[] {
  const slugs: string[] = [];
  for (const event of events) {
    if (shouldSkipModule(event.sourceModule, skipModules) || shouldSkipVenue(event)) {
      continue;
    }
    const slug = event.slug?.trim();
    if (slug) {
      slugs.push(slug);
    }
  }
  return slugs;
}

/** Fetch `/api/events/{slug}` for each slug (polite delay between new requests). */
export async function loadVenuniteEventDetails(
  slugs: Iterable<string>,
  cache: Map<string, VenuniteEventDetail>,
  options: LoadVenuniteEventDetailsOptions,
  errors: ScrapeError[] = []
): Promise<number> {
  const fetchFn = options.fetchImpl ?? fetch;
  const delayMs = options.delayMs ?? 200;
  let fetched = 0;

  for (const slug of slugs) {
    if (cache.has(slug)) {
      continue;
    }
    if (options.signal?.aborted) {
      throw new DOMException("Aborted", "AbortError");
    }

    const url = buildVenuniteEventDetailApiUrl(slug);
    try {
      const response = await fetchFn(url, {
        headers: {
          Accept: "application/json",
          "User-Agent": options.userAgent
        },
        ...(options.signal ? { signal: options.signal } : {})
      });

      if (response.ok) {
        const detail = parseVenuniteEventDetail(await response.json());
        if (detail) {
          cache.set(slug, detail);
          fetched += 1;
          options.onFetched?.(slug);
        } else {
          errors.push({
            source: "venunite",
            url,
            message: "VenuNite event detail response was empty or invalid.",
            recoverable: true
          });
        }
      } else {
        errors.push({
          source: "venunite",
          url,
          message: `VenuNite event detail responded with ${response.status}.`,
          recoverable: response.status >= 500 || response.status === 429
        });
      }
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") {
        throw error;
      }
      errors.push({
        source: "venunite",
        url,
        message: error instanceof Error ? error.message : "VenuNite event detail fetch failed.",
        recoverable: true
      });
    }

    await sleep(delayMs);
  }

  return fetched;
}

export function detailVenueToVenueDetail(detail: VenuniteEventDetail): VenuniteVenueDetail | undefined {
  const venue = detail.venue;
  if (!venue?.id || !venue.name?.trim()) {
    return undefined;
  }

  return {
    id: venue.id,
    name: venue.name,
    address: venue.address,
    city: venue.city,
    state: venue.state,
    zip: venue.zip,
    latitude: venue.latitude,
    longitude: venue.longitude
  };
}

function isCostOnlyDescription(text: string | undefined): boolean {
  return Boolean(text?.trim().match(/^Cost:\s*.+$/i));
}

export function resolveVenuniteDescriptionText(
  event: VenuniteEvent,
  detail?: VenuniteEventDetail | null
): string | undefined {
  const detailText = detail?.description?.trim();
  if (detailText) {
    return detailText;
  }

  const cost = detail?.cost?.trim() || event.cost?.trim();
  if (cost) {
    return `Cost: ${cost}`;
  }

  return undefined;
}

export function buildVenuniteTags(event: VenuniteEvent, detail?: VenuniteEventDetail | null): string[] {
  const tags = new Set<string>(["venunite", `upstream:${event.sourceModule}`]);
  const slug = event.slug?.trim();
  if (slug) {
    tags.add(`venunite_slug:${slug}`);
  }
  if (detail?.soldOut) {
    tags.add("sold-out");
  }
  if (detail?.isCancelled) {
    tags.add("cancelled");
  }
  if (detail?.isFeatured) {
    tags.add("featured");
  }
  return [...tags];
}

export function mergeVenuniteDetailFields(
  listing: NormalizedEvent,
  event: VenuniteEvent,
  detail?: VenuniteEventDetail | null
): NormalizedEvent {
  if (!detail) {
    return { ...listing, ...applyVenuniteFreeAdmissionFields(listing) };
  }

  const descriptionText = resolveVenuniteDescriptionText(event, detail);
  const next: NormalizedEvent = {
    ...listing,
    tags: buildVenuniteTags(event, detail)
  };

  if (
    descriptionText &&
    (!listing.descriptionText?.trim() ||
      isCostOnlyDescription(listing.descriptionText) ||
      descriptionText.length > listing.descriptionText.length)
  ) {
    next.descriptionText = descriptionText;
  }

  const detailImage = detail.imageUrl?.trim();
  if (detailImage && (!listing.imageUrl?.trim() || detailImage.length >= listing.imageUrl.length)) {
    next.imageUrl = detailImage;
  }

  const priceFields = resolveVenunitePriceFields(
    detail.priceWatch ?? event.priceWatch,
    detail.cost ?? event.cost
  );
  if (priceFields.isFree) {
    next.isFree = true;
    next.priceMin = 0;
    next.priceMax = 0;
    if (priceFields.priceNotes) {
      next.priceNotes = priceFields.priceNotes;
    }
  } else {
    if (priceFields.priceMin != null && next.priceMin == null) {
      next.priceMin = priceFields.priceMin;
    }
    if (priceFields.priceMax != null && next.priceMax == null) {
      next.priceMax = priceFields.priceMax;
    }
  }
  if (priceFields.currency) {
    next.currency = priceFields.currency;
  }

  const doorTime = detail.doorTime?.trim();
  if (doorTime && !listing.doorsTs) {
    next.doorsTs = doorTime;
  }

  const age = detail.age?.trim();
  if (age && !listing.ageRestriction) {
    next.ageRestriction = age;
  }

  const upstreamWebsite = detail.website?.trim() || event.website?.trim();
  if (upstreamWebsite) {
    next.externalUrl = upstreamWebsite;
    next.ticketUrl = upstreamWebsite;
  }

  return { ...next, ...applyVenuniteFreeAdmissionFields(next) };
}
