import { eventCategories, type EventCategory, type NormalizedEvent, type ScrapeError } from "@fresno-events/shared";

import type { AiDiscoveryItem } from "@/ai";
import { sleep } from "@/lib/sleep";
import { extractEventsFromMarkdown, type ExtractorVariant } from "@/ai/extractor";
import type { IngestEnv } from "@/env";
import { renderUrlToHtml, renderUrlToMarkdown } from "@/browser-rendering/render-page";
import type { VenueConfig } from "@/venues/venue.types";
import { parseConventionDetailPage } from "@/venues/fresno-convention-center/convention-detail.utils";
import { enrichEventWithTicketSiteDetail } from "@/scrapers/ticket-site-detail.utils";
import { parsePlainHtmlDetailPage } from "@/venues/_shared/html-detail.utils";
import { isDetailHostBlocked, resolveDetailMode, resolveListingDiscovery } from "@/venues/venue-profile.utils";
import { toNormalizedEventFromDiscovery } from "@/normalized-event";

const ALLOWED_CATEGORIES: ReadonlySet<string> = new Set(eventCategories);

export const DEFAULT_DETAIL_URL_CAP = 40;
export const DETAIL_DELAY_MS = 1_000;

export function resolveDetailCap(config: VenueConfig): number {
  return config.detailUrlCap ?? DEFAULT_DETAIL_URL_CAP;
}

export function resolveLlmCap(config: VenueConfig): number {
  return config.llmCallCap ?? 60;
}

function isVenueListingRoot(externalUrl: string): boolean {
  try {
    const path = new URL(externalUrl).pathname.replace(/\/+$/, "") || "/";
    return path === "/";
  } catch {
    return false;
  }
}

const PLACEHOLDER_DETAIL_TITLES = new Set(["even name", "event name", "untitled"]);

function isPlaceholderDetailTitle(title: string | undefined): boolean {
  const normalized = title?.trim().toLowerCase();
  return !normalized || PLACEHOLDER_DETAIL_TITLES.has(normalized);
}

function resolveMergedExternalUrl(listing: NormalizedEvent, detail: AiDiscoveryItem): string | undefined {
  const detailUrl = detail.externalUrl?.trim();
  const listingUrl = listing.externalUrl?.trim();
  if (detailUrl && (!listingUrl || isVenueListingRoot(listingUrl))) {
    return detailUrl;
  }
  return listingUrl ?? detailUrl;
}

export function mergeListingWithDetail(
  listing: NormalizedEvent,
  detail: AiDiscoveryItem | null
): NormalizedEvent {
  if (!detail?.title?.trim() || !detail.venueName?.trim()) {
    return listing;
  }

  const startTs = detail.startTs ?? listing.startTs;
  const start = new Date(startTs);
  if (Number.isNaN(start.getTime())) {
    return listing;
  }

  const category: EventCategory =
    detail.category && ALLOWED_CATEGORIES.has(detail.category as EventCategory)
      ? (detail.category as EventCategory)
      : (listing.category ?? "community");

  const externalUrl = resolveMergedExternalUrl(listing, detail);
  const imageUrl = detail.imageUrl?.trim() || listing.imageUrl?.trim();

  const mergedTitle = isPlaceholderDetailTitle(detail.title) ? listing.title : detail.title.trim();

  return {
    ...listing,
    title: mergedTitle,
    venueName: detail.venueName.trim(),
    startTs: start.toISOString(),
    category,
    ...(detail.descriptionText?.trim()
      ? { descriptionText: detail.descriptionText.trim() }
      : {}),
    ...(detail.venueAddress?.trim() ? { venueAddress: detail.venueAddress.trim() } : {}),
    ...(detail.venueCity?.trim() ? { venueCity: detail.venueCity.trim() } : {}),
    ...(typeof detail.venueLat === "number" ? { venueLat: detail.venueLat } : {}),
    ...(typeof detail.venueLng === "number" ? { venueLng: detail.venueLng } : {}),
    ...(detail.ticketUrl?.trim() ? { ticketUrl: detail.ticketUrl.trim() } : {}),
    ...(imageUrl ? { imageUrl } : {}),
    ...(typeof detail.priceMin === "number" ? { priceMin: detail.priceMin } : {}),
    ...(typeof detail.priceMax === "number" ? { priceMax: detail.priceMax } : {}),
    ...(externalUrl ? { externalUrl } : {})
  };
}

function parseDetailPage(html: string, pageUrl: string, config: VenueConfig): AiDiscoveryItem | null {
  if (config.key === "fresno-convention-center") {
    return parseConventionDetailPage(html, pageUrl);
  }
  return parsePlainHtmlDetailPage(html, pageUrl, config.label);
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
  const { env, config, listings, detailUrls, signal, dryRun, llmState, sourceKey, userAgent } = input;
  const errors: ScrapeError[] = [];
  const variant: ExtractorVariant = config.extractorVariant ?? "default";
  const detailMode = resolveDetailMode(config);

  if (dryRun || detailMode === "none" || detailMode === "api_embedded") {
    return {
      events: listings,
      errors: [],
      detailUrlsVisited: 0,
      llmCalls: llmState.count
    };
  }

  const normalizeDetailUrl = (url: string) => url.replace(/\/+$/, "");
  const byUrl = new Map(
    listings
      .filter((e) => e.externalUrl?.startsWith("http"))
      .map((e) => [normalizeDetailUrl(e.externalUrl!), e])
  );
  const bySourceEventId = new Map(listings.map((e) => [e.sourceEventId, e]));
  let detailUrlsVisited = 0;
  const total = detailUrls.length;

  console.log(
    JSON.stringify({
      event: "venue_ingest",
      venue_key: config.key,
      step: "detail_enrich_start",
      detail_url_count: total,
      listing_count: listings.length
    })
  );

  for (const url of detailUrls) {
    if (isDetailHostBlocked(url, config)) {
      continue;
    }

    const listing = byUrl.get(normalizeDetailUrl(url));
    if (!listing) {
      continue;
    }

    if (detailMode === "plain_html") {
      detailUrlsVisited += 1;
      throwIfAborted(signal);
      try {
        const html = await fetchListingHtml(url, userAgent, signal);
        const parsed = parseDetailPage(html, url, config);
        let merged = mergeListingWithDetail(listing, parsed);
        merged = await enrichEventWithTicketSiteDetail(merged, userAgent, { signal });
        bySourceEventId.set(listing.sourceEventId, merged);
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") {
          throw error;
        }
        errors.push({
          source: sourceKey,
          url,
          message: error instanceof Error ? error.message : "plain detail fetch failed",
          recoverable: true
        });
      }
      await sleep(DETAIL_DELAY_MS);
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

    console.log(
      JSON.stringify({
        event: "venue_ingest",
        venue_key: config.key,
        step: "detail_enrich_page",
        page: detailUrlsVisited,
        total,
        url
      })
    );

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

    console.log(
      JSON.stringify({
        event: "venue_ingest",
        venue_key: config.key,
        step: "detail_enrich_page_done",
        page: detailUrlsVisited,
        total,
        title: bySourceEventId.get(listing.sourceEventId)?.title ?? listing.title
      })
    );

    await sleep(DETAIL_DELAY_MS);
  }

  console.log(
    JSON.stringify({
      event: "venue_ingest",
      venue_key: config.key,
      step: "detail_enrich_end",
      detail_urls_visited: detailUrlsVisited,
      llm_calls: llmState.count,
      errors: errors.length
    })
  );

  return {
    events: [...bySourceEventId.values()],
    errors,
    detailUrlsVisited,
    llmCalls: llmState.count
  };
}

const LISTING_FETCH_RETRIES = 2;
const LISTING_RETRY_BASE_MS = 500;

/**
 * Fetch listing HTML with bounded retry + exponential backoff. Retries transient
 * failures (network errors, 429, 5xx); 4xx and abort are thrown immediately.
 */
export async function fetchListingHtml(url: string, userAgent: string, signal?: AbortSignal): Promise<string> {
  let lastError: Error = new Error(`Failed fetching ${url}`);

  for (let attempt = 0; attempt <= LISTING_FETCH_RETRIES; attempt += 1) {
    throwIfAborted(signal);
    let retryable = false;
    try {
      const response = await fetch(url, {
        headers: { "User-Agent": userAgent, Accept: "text/html" },
        ...(signal ? { signal } : {})
      });
      if (response.ok) {
        return await response.text();
      }
      lastError = new Error(`HTTP ${response.status} fetching ${url}`);
      retryable = response.status === 429 || response.status >= 500;
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") {
        throw error;
      }
      lastError = error instanceof Error ? error : new Error(`Failed fetching ${url}`);
      retryable = true;
    }

    if (!retryable || attempt === LISTING_FETCH_RETRIES) {
      throw lastError;
    }
    await sleep(LISTING_RETRY_BASE_MS * 2 ** attempt);
  }

  throw lastError;
}

/**
 * Fetch + parse a listing, falling back to Browser Rendering when the direct SSR
 * fetch parses to zero events and the venue opts in via `listingDiscovery: br_if_empty`.
 * Defensive: only triggers when the cheap path returns nothing, so a site that quietly
 * moves to client-side rendering doesn't silently drop to zero events.
 */
export async function fetchAndParseListingHtml(
  env: IngestEnv,
  config: VenueConfig,
  parse: (html: string) => NormalizedEvent[],
  opts: { userAgent: string; signal?: AbortSignal }
): Promise<NormalizedEvent[]> {
  const html = await fetchListingHtml(config.listingUrl, opts.userAgent, opts.signal);
  const direct = parse(html);
  if (direct.length > 0 || resolveListingDiscovery(config) !== "br_if_empty") {
    return direct;
  }

  const rendered = await renderUrlToHtml(env, config.listingUrl, opts.signal ? { signal: opts.signal } : {});
  if ("error" in rendered) {
    console.log(
      JSON.stringify({
        event: "venue_ingest",
        venue_key: config.key,
        step: "listing_br_fallback_failed",
        error: rendered.error
      })
    );
    return direct;
  }

  const fromBr = parse(rendered.html);
  console.log(
    JSON.stringify({
      event: "venue_ingest",
      venue_key: config.key,
      step: "listing_br_fallback",
      events_found: fromBr.length
    })
  );
  return fromBr;
}

export function absoluteUrl(href: string, base: string): string | null {
  try {
    return new URL(href, base).href;
  } catch {
    return null;
  }
}

export function hostAllowed(url: string, config: VenueConfig): boolean {
  if (isDetailHostBlocked(url, config)) {
    return false;
  }
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
