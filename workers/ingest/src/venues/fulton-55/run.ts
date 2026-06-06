import type { IngestEnv } from "@/env";
import { fetchListingHtml } from "@/venues/_shared/listing-detail.utils";
import { runHtmlParseVenue } from "@/venues/_shared/html-parse.run";
import type { VenueConfig, VenueRunContext, VenueRunResult } from "@/venues/venue.types";

import { parseFulton55ListingHtml } from "./fulton-listing.utils";
import configJson from "./venue.config.json";

const config = configJson as VenueConfig;

async function parseFulton55Listing(
  _env: IngestEnv,
  venueConfig: VenueConfig,
  ctx: VenueRunContext
): Promise<import("@fresno-events/shared").NormalizedEvent[]> {
  const html = await fetchListingHtml(venueConfig.listingUrl, ctx.userAgent, ctx.signal);
  return parseFulton55ListingHtml(html, venueConfig);
}

export const run = (env: IngestEnv, ctx: VenueRunContext): Promise<VenueRunResult> =>
  runHtmlParseVenue(env, config, ctx, parseFulton55Listing);

export { config };
