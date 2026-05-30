import type { NormalizedEvent, ScrapeError } from "@fresno-events/shared";

import type { IngestEnv } from "@/env";
import type { VenueConfig, VenueRunContext, VenueRunResult } from "@/venues/venue.types";

export type HtmlParseFn = (env: IngestEnv, config: VenueConfig, ctx: VenueRunContext) => Promise<NormalizedEvent[]>;

export async function runHtmlParseVenue(
  env: IngestEnv,
  config: VenueConfig,
  ctx: VenueRunContext,
  parse: HtmlParseFn
): Promise<VenueRunResult> {
  const sourceKey = `venue-ingest:${config.key}`;
  const errors: ScrapeError[] = [];

  if (ctx.dryRun) {
    try {
      const events = await parse(env, config, ctx);
      return {
        events,
        errors,
        listingUrlsFound: 1,
        detailUrlsVisited: 0,
        llmCalls: 0,
        debug: {
          listingUrls: [config.listingUrl],
          detailUrlsPlanned: events.length,
          note: "dry-run — html_parse venue"
        }
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return {
        events: [],
        errors: [{ source: sourceKey, message, recoverable: true }],
        listingUrlsFound: 0,
        detailUrlsVisited: 0,
        llmCalls: 0,
        debug: { errors: [message] }
      };
    }
  }

  try {
    const events = await parse(env, config, ctx);
    return {
      events,
      errors,
      listingUrlsFound: 1,
      detailUrlsVisited: 0,
      llmCalls: 0,
      debug: { listingUrls: [config.listingUrl], note: `parsed ${events.length} events` }
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      events: [],
      errors: [{ source: sourceKey, message, recoverable: true }],
      listingUrlsFound: 0,
      detailUrlsVisited: 0,
      llmCalls: 0,
      debug: { errors: [message] }
    };
  }
}
