import type { ScraperRun } from "@fresno-events/shared";

import type { IngestEnv } from "@/env";
import type { VenueConfig, VenueRunContext, VenueRunResult } from "@/venues/venue.types";
import { buildVenueScrapeContext } from "@/venues/_shared/venue-scrape-context.utils";

export async function runApiVenue(
  env: IngestEnv,
  config: VenueConfig,
  ctx: VenueRunContext,
  scraper: ScraperRun
): Promise<VenueRunResult> {
  const scrapeCtx = buildVenueScrapeContext(env, ctx);
  const result = await scraper(scrapeCtx);

  return {
    events: result.events,
    errors: result.errors,
    listingUrlsFound: 1,
    detailUrlsVisited: Math.max(0, result.metrics.pagesVisited - 1),
    llmCalls: 0,
    debug: {
      listingUrls: [config.listingUrl],
      note: config.eventSource ? `api venue (${config.eventSource})` : "api venue"
    }
  };
}
