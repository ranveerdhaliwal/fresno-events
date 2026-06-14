import type { ScraperRun } from "@fresno-events/shared";

import type { IngestEnv } from "@/env";
import type { VenueConfig, VenueRunContext, VenueRunResult } from "@/venues/venue.types";
import { hasUsablePrice } from "@/candidates/linked-price.utils";
import { enrichApiVenueEventsWithDetailPrices } from "@/venues/_shared/api-venue-price-detail.utils";
import { buildVenueScrapeContext } from "@/venues/_shared/venue-scrape-context.utils";
import { resolveDetailMode } from "@/venues/venue-profile.utils";

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

  let events = result.events;
  let detailUrlsVisited = Math.max(0, result.metrics.pagesVisited - 1);

  if (resolveDetailMode(config) === "plain_html" && !ctx.dryRun) {
    const priced = await enrichApiVenueEventsWithDetailPrices(events, config, ctx.userAgent, {
      ...(ctx.signal ? { signal: ctx.signal } : {})
    });
    events = priced.events;
    detailUrlsVisited += priced.detailUrlsVisited;
    const pricedCount = events.filter((event) => hasUsablePrice(event)).length;
    console.log(
      JSON.stringify({
        event: "venue_ingest",
        venue_key: config.key,
        step: "api_price_detail_done",
        events: events.length,
        priced_count: pricedCount,
        detail_urls_visited: priced.detailUrlsVisited
      })
    );
  }

  console.log(
    JSON.stringify({
      event: "venue_ingest",
      venue_key: config.key,
      step: "api_venue_done",
      dry_run: ctx.dryRun,
      events_found: events.length,
      errors: result.errors.length,
      duration_ms: result.metrics.durationMs
    })
  );

  return {
    events,
    errors: result.errors,
    listingUrlsFound: 1,
    detailUrlsVisited,
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
