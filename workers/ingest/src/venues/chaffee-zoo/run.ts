import type { IngestEnv } from "@/env";
import { fetchAndParseListingHtml } from "@/venues/_shared/listing-detail.utils";
import { runHtmlParseVenue } from "@/venues/_shared/html-parse.run";
import type { VenueConfig, VenueRunContext, VenueRunResult } from "@/venues/venue.types";

import { parseChaffeeListingHtml } from "./chaffee-listing.utils";
import configJson from "./venue.config.json";

const config = configJson as VenueConfig;

async function parseChaffeeListing(
  env: IngestEnv,
  venueConfig: VenueConfig,
  ctx: VenueRunContext
): Promise<import("@fresno-events/shared").NormalizedEvent[]> {
  const now = new Date();
  return fetchAndParseListingHtml(env, venueConfig, (html) => parseChaffeeListingHtml(html, venueConfig, now), {
    userAgent: ctx.userAgent,
    ...(ctx.signal ? { signal: ctx.signal } : {})
  });
}

export const run = (env: IngestEnv, ctx: VenueRunContext): Promise<VenueRunResult> =>
  runHtmlParseVenue(env, config, ctx, parseChaffeeListing);

export { config };
