import type { EventCategory, NormalizedEvent, ScrapeError } from "@fresno-events/shared";

import type { AiDiscoveryItem } from "@/ai";
import { extractEventsFromMarkdown, type ExtractorVariant } from "@/ai/extractor";
import type { IngestEnv } from "@/env";
import { renderUrlToMarkdown } from "@/browser-rendering/render-page";
import type { VenueConfig } from "@/venues/venue.types";
import { toNormalizedEventFromDiscovery } from "@/normalized-event";

const ALLOWED_CATEGORIES = new Set<EventCategory>([
  "music",
  "comedy",
  "theater",
  "sports",
  "food_drink",
  "festival",
  "family",
  "art",
  "nightlife",
  "community",
  "outdoor",
  "wellness",
  "education"
]);

export const DEFAULT_DETAIL_URL_CAP = 40;
export const DETAIL_DELAY_MS = 1_000;

export function resolveDetailCap(config: VenueConfig): number {
  return config.detailUrlCap ?? DEFAULT_DETAIL_URL_CAP;
}

export function resolveLlmCap(config: VenueConfig): number {
  return config.llmCallCap ?? 60;
}

export function mergeListingWithDetail(
  listing: NormalizedEvent,
  detail: AiDiscoveryItem | null
): NormalizedEvent {
  if (!detail?.title?.trim() || !detail.venueName?.trim() || !detail.startTs) {
    return listing;
  }

  const start = new Date(detail.startTs);
  if (Number.isNaN(start.getTime())) {
    return listing;
  }

  const category: EventCategory =
    detail.category && ALLOWED_CATEGORIES.has(detail.category as EventCategory)
      ? (detail.category as EventCategory)
      : (listing.category ?? "community");

  return {
    ...listing,
    title: detail.title.trim(),
    venueName: detail.venueName.trim(),
    startTs: start.toISOString(),
    category,
    ...(detail.descriptionText?.trim()
      ? { descriptionText: detail.descriptionText.trim() }
      : {}),
    ...(detail.venueAddress?.trim() ? { venueAddress: detail.venueAddress.trim() } : {}),
    ...(detail.venueCity?.trim() ? { venueCity: detail.venueCity.trim() } : {}),
    ...(detail.ticketUrl?.trim() ? { ticketUrl: detail.ticketUrl.trim() } : {}),
    ...(detail.imageUrl?.trim() ? { imageUrl: detail.imageUrl.trim() } : {}),
    ...(typeof detail.priceMin === "number" ? { priceMin: detail.priceMin } : {}),
    ...(typeof detail.priceMax === "number" ? { priceMax: detail.priceMax } : {}),
    ...(listing.externalUrl ? { externalUrl: listing.externalUrl } : {}),
    ...(!listing.externalUrl && detail.externalUrl ? { externalUrl: detail.externalUrl } : {})
  };
}

function seedUrlForConfig(config: VenueConfig): string {
  if (config.sourceHostname) {
    return `https://${config.sourceHostname.replace(/^www\./, "")}/`;
  }
  return config.listingUrl;
}

export function listingFromDiscoveryItem(
  item: AiDiscoveryItem,
  pageUrl: string,
  config: VenueConfig
): NormalizedEvent | null {
  return toNormalizedEventFromDiscovery(item, pageUrl, seedUrlForConfig(config), "venue-ingest", {
    ...(config.seriesId ? { seriesId: config.seriesId } : {})
  });
}

function sleep(ms: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms));
}

function throwIfAborted(signal: AbortSignal | undefined) {
  if (signal?.aborted) {
    throw new DOMException("Ingest aborted", "AbortError");
  }
}

export interface EnrichDetailsInput {
  env: IngestEnv;
  config: VenueConfig;
  listings: NormalizedEvent[];
  detailUrls: string[];
  userAgent: string;
  signal?: AbortSignal;
  dryRun: boolean;
  llmState: { count: number; cap: number };
  sourceKey: string;
}

export interface EnrichDetailsResult {
  events: NormalizedEvent[];
  errors: ScrapeError[];
  detailUrlsVisited: number;
  llmCalls: number;
}

export async function enrichListingsWithDetails(input: EnrichDetailsInput): Promise<EnrichDetailsResult> {
  const { env, config, listings, detailUrls, signal, dryRun, llmState, sourceKey } = input;
  const errors: ScrapeError[] = [];
  const variant: ExtractorVariant = config.extractorVariant ?? "default";

  if (dryRun) {
    return {
      events: listings,
      errors: [],
      detailUrlsVisited: 0,
      llmCalls: llmState.count
    };
  }

  const byUrl = new Map(
    listings.filter((e) => e.externalUrl?.startsWith("http")).map((e) => [e.externalUrl!, e])
  );
  const bySourceEventId = new Map(listings.map((e) => [e.sourceEventId, e]));
  let detailUrlsVisited = 0;

  for (const url of detailUrls) {
    const listing = byUrl.get(url);
    if (!listing) {
      continue;
    }

    if (llmState.count >= llmState.cap) {
      errors.push({
        source: sourceKey,
        url,
        message: `LLM cap (${llmState.cap}) reached`,
        recoverable: true
      });
      break;
    }

    detailUrlsVisited += 1;
    throwIfAborted(signal);

    const rendered = await renderUrlToMarkdown(env, url, signal ? { signal } : {});
    if ("error" in rendered) {
      errors.push({
        source: sourceKey,
        url,
        message: rendered.error,
        recoverable: true
      });
      await sleep(DETAIL_DELAY_MS);
      continue;
    }

    try {
      const extracted = await extractEventsFromMarkdown(env, {
        url,
        label: config.label,
        markdown: rendered.markdown,
        variant
      });
      llmState.count += 1;

      const detail = extracted[0] ?? null;
      bySourceEventId.set(listing.sourceEventId, mergeListingWithDetail(listing, detail));

      if (!detail) {
        errors.push({
          source: sourceKey,
          url,
          message: "LLM returned no events for detail page",
          recoverable: true
        });
      }
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") {
        throw error;
      }
      errors.push({
        source: sourceKey,
        url,
        message: error instanceof Error ? error.message : "detail enrichment failed",
        recoverable: true
      });
    }

    await sleep(DETAIL_DELAY_MS);
  }

  return {
    events: [...bySourceEventId.values()],
    errors,
    detailUrlsVisited,
    llmCalls: llmState.count
  };
}

export async function fetchListingHtml(url: string, userAgent: string, signal?: AbortSignal): Promise<string> {
  const response = await fetch(url, {
    headers: { "User-Agent": userAgent, Accept: "text/html" },
    ...(signal ? { signal } : {})
  });
  if (!response.ok) {
    throw new Error(`HTTP ${response.status} fetching ${url}`);
  }
  return response.text();
}

export function absoluteUrl(href: string, base: string): string | null {
  try {
    return new URL(href, base).href;
  } catch {
    return null;
  }
}

export function hostAllowed(url: string, config: VenueConfig): boolean {
  try {
    const host = new URL(url).hostname.replace(/^www\./, "");
    const listingHost = new URL(config.listingUrl).hostname.replace(/^www\./, "");
    if (host === listingHost) {
      return true;
    }
    const allowed = config.allowedExternalHosts ?? [];
    return allowed.some((h) => host === h.replace(/^www\./, "") || host.endsWith(`.${h.replace(/^www\./, "")}`));
  } catch {
    return false;
  }
}
