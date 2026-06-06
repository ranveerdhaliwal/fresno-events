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
  console.log(
    JSON.stringify({
      event: "venue_ingest",
      venue_key: config.key,
      step: "api_venue_start",
      dry_run: ctx.dryRun,
      lane: "direct",
      event_source: config.eventSource ?? null
    })
  );

  const scrapeCtx = buildVenueScrapeContext(env, ctx);
  const result = await scraper(scrapeCtx);

  console.log(
    JSON.stringify({
      event: "venue_ingest",
      venue_key: config.key,
      step: "api_venue_done",
      dry_run: ctx.dryRun,
      events_found: result.events.length,
      errors: result.errors.length,
      duration_ms: result.metrics.durationMs
    })
  );

  return {
    events: result.events,
    errors: result.errors,
    listingUrlsFound: 1,
    detailUrlsVisited: Math.max(0, result.metrics.pagesVisited - 1),
    llmCalls: 0,
    debug: {
      listingUrls: [config.listingUrl],
      fetchUrls:
        result.metrics.fetchUrls && result.metrics.fetchUrls.length > 0
          ? result.metrics.fetchUrls
          : [config.listingUrl],
      note: config.eventSource ? `api venue (${config.eventSource})` : "api venue"
    }
  };
}
