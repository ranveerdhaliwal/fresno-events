import type { IngestEnv } from "@/env";
import { fetchAndParseListingHtml } from "@/venues/_shared/listing-detail.utils";
import { runHtmlParseVenue } from "@/venues/_shared/html-parse.run";
import type { VenueConfig, VenueRunContext, VenueRunResult } from "@/venues/venue.types";

import { addStrummersTicketLinks, parseStrummersListingHtml } from "./strummers-listing.utils";
import configJson from "./venue.config.json";

const config = configJson as VenueConfig;

async function parseStrummersListing(
  env: IngestEnv,
  venueConfig: VenueConfig,
  ctx: VenueRunContext
): Promise<import("@fresno-events/shared").NormalizedEvent[]> {
  const events = await fetchAndParseListingHtml(env, venueConfig, (html) => parseStrummersListingHtml(html, venueConfig), {
    userAgent: ctx.userAgent,
    ...(ctx.signal ? { signal: ctx.signal } : {})
  });
  const url = new URL(venueConfig.listingUrl);
  url.searchParams.set("format", "json");
  try {
    const response = await fetch(url, { headers: { "User-Agent": ctx.userAgent }, ...(ctx.signal ? { signal: ctx.signal } : {}) });
    if (response.ok) return addStrummersTicketLinks(events, await response.json());
  } catch (error) {
    if (ctx.signal?.aborted) throw error;
  }
  return events;
}

export const run = (env: IngestEnv, ctx: VenueRunContext): Promise<VenueRunResult> =>
  runHtmlParseVenue(env, config, ctx, parseStrummersListing);

export { config };
