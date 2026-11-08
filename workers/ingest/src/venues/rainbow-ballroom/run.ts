import type { IngestEnv } from "@/env";
import { fetchAndParseListingHtml, fetchListingHtml } from "@/venues/_shared/listing-detail.utils";
import { runHtmlParseVenue } from "@/venues/_shared/html-parse.run";
import type { VenueConfig, VenueRunContext, VenueRunResult } from "@/venues/venue.types";

import { parseRainbowListingHtml } from "./rainbow-listing.utils";
import { mergeRainbowTicketDetail } from "./rainbow-ticket.utils";
import configJson from "./venue.config.json";

const config = configJson as VenueConfig;

async function parseRainbowListing(
  env: IngestEnv,
  venueConfig: VenueConfig,
  ctx: VenueRunContext
): Promise<import("@fresno-events/shared").NormalizedEvent[]> {
  const events = await fetchAndParseListingHtml(
    env,
    venueConfig,
    (html) => parseRainbowListingHtml(html, venueConfig),
    {
      userAgent: ctx.userAgent,
      ...(ctx.signal ? { signal: ctx.signal } : {})
    }
  );
  for (let i = 0; i < events.length; i++) {
    const event = events[i]!;
    // This official box office supplies explicit, timezone-aware show times.
    if (
      !event.ticketUrl ||
      !["tickets.klinevents.com", "posh.vip"].includes(new URL(event.ticketUrl).hostname)
    )
      continue;
    try {
      const html = await fetchListingHtml(event.ticketUrl, ctx.userAgent, ctx.signal);
      events[i] = mergeRainbowTicketDetail(event, html);
    } catch (error) {
      if (ctx.signal?.aborted) throw error;
      console.log(
        JSON.stringify({
          event: "rainbow_ticket_detail_failed",
          url: event.ticketUrl,
          message: error instanceof Error ? error.message : String(error)
        })
      );
    }
  }
  return events;
}

export const run = (env: IngestEnv, ctx: VenueRunContext): Promise<VenueRunResult> =>
  runHtmlParseVenue(env, config, ctx, parseRainbowListing);

export { config };
