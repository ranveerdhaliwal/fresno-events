import type { EventSource, NormalizedEvent, ScrapeError } from "@fresno-events/shared";

import type { IngestEnv } from "@/env";
import {
  enrichListingsWithDetails,
  fetchListingHtml,
  resolveDetailCap,
  resolveLlmCap
} from "@/venues/_shared/listing-detail.utils";
import type { VenueConfig, VenueRunContext, VenueRunResult } from "@/venues/venue.types";

import { parseConventionListingHtml } from "./convention-listing.utils";
import { applyConventionVenueLocation } from "./convention-venue-location.utils";
import { inferConventionCategory } from "./convention-category.utils";
import configJson from "./venue.config.json";

const config = configJson as VenueConfig;

function finalizeConventionEvent(event: NormalizedEvent): NormalizedEvent {
  const withVenue = applyConventionVenueLocation(event);
  return {
    ...withVenue,
    category: inferConventionCategory(withVenue.title)
  };
}

function stubListing(url: string, venueConfig: VenueConfig, scrapeSource: EventSource): NormalizedEvent {
  const slug = new URL(url).pathname.split("/").filter(Boolean).pop() ?? "event";
  return {
    source: scrapeSource,
    sourceEventId: `venue:${venueConfig.key}:${slug}`,
    title: slug.replace(/-/g, " "),
    venueName: venueConfig.label,
    venueCity: "Fresno",
    startTs: new Date().toISOString(),
    externalUrl: url.replace(/\/+$/, ""),
    category: "community"
  };
}

export async function run(env: IngestEnv, ctx: VenueRunContext): Promise<VenueRunResult> {
  const sourceKey = `venue-ingest:${config.key}`;
  const errors: ScrapeError[] = [];
  const scrapeSource = `scrape:${config.sourceHostname?.replace(/^www\./, "") ?? "events.fresnoconventioncenter.com"}` as EventSource;
  const now = new Date();

  let html = "";
  try {
    html = await fetchListingHtml(config.listingUrl, ctx.userAgent, ctx.signal);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      events: [],
      errors: [{ source: sourceKey, url: config.listingUrl, message, recoverable: true }],
      listingUrlsFound: 0,
      detailUrlsVisited: 0,
      llmCalls: 0,
      debug: { errors: [message] }
    };
  }

  const parsedByUrl = new Map<string, NormalizedEvent>();
  for (const event of parseConventionListingHtml(html, config, now)) {
    const url = event.externalUrl?.replace(/\/+$/, "");
    if (url?.startsWith("http")) {
      parsedByUrl.set(url, event);
    }
  }

  const detailCap = resolveDetailCap(config);
  // Only fetch listing cards — ignore stray internal links (old show pages still in site HTML).
  const detailUrls = [...parsedByUrl.keys()].slice(0, detailCap);

  if (ctx.dryRun) {
    return {
      events: [...parsedByUrl.values()].map(finalizeConventionEvent),
      errors,
      listingUrlsFound: 1,
      detailUrlsVisited: 0,
      llmCalls: 0,
      debug: {
        listingUrls: [config.listingUrl],
        fetchUrls: [config.listingUrl],
        detailUrls,
        detailUrlsPlanned: detailUrls.length,
        note: "dry-run — detail pages fetched on promote"
      }
    };
  }

  const listings: NormalizedEvent[] = [];
  for (const url of detailUrls) {
    const key = url.replace(/\/+$/, "");
    listings.push(parsedByUrl.get(key) ?? stubListing(url, config, scrapeSource));
  }

  const llmState = { count: 0, cap: resolveLlmCap(config) };
  const enriched = await enrichListingsWithDetails({
    env,
    config,
    listings,
    detailUrls,
    userAgent: ctx.userAgent,
    dryRun: false,
    llmState,
    sourceKey,
    ...(ctx.signal ? { signal: ctx.signal } : {})
  });

  return {
    events: enriched.events.map(finalizeConventionEvent),
    errors: [...errors, ...enriched.errors],
    listingUrlsFound: 1,
    detailUrlsVisited: enriched.detailUrlsVisited,
    llmCalls: enriched.llmCalls,
    debug: {
      listingUrls: [config.listingUrl],
      fetchUrls: [config.listingUrl, ...detailUrls],
      detailUrls,
      detailUrlsPlanned: detailUrls.length,
      llmCalls: enriched.llmCalls
    }
  };
}

export { config };
