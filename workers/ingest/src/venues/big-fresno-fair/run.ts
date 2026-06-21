import type { IngestEnv } from "@/env";
import { enrichFresnoFairEventsWithDetails } from "@/scrapers/fresno-fair-detail.utils";
import { run as runFresnoFairApi } from "@/scrapers/fresno-fair-api";
import { runApiVenue } from "@/venues/_shared/api-venue.run";
import type { VenueConfig, VenueRunContext, VenueRunResult } from "@/venues/venue.types";

import configJson from "./venue.config.json";

const config = configJson as VenueConfig;
const sourceKey = `venue-ingest:${config.key}`;

export async function run(env: IngestEnv, ctx: VenueRunContext): Promise<VenueRunResult> {
  const base = await runApiVenue(env, config, ctx, (scrapeCtx) =>
    runFresnoFairApi(scrapeCtx, {
      seriesId: config.seriesId,
      listingUrl: config.listingUrl
    })
  );

  const detailUrlsPlanned = new Set(
    base.events
      .map((event) => event.externalUrl?.replace(/\/+$/, ""))
      .filter((url): url is string => Boolean(url?.startsWith("http")))
  ).size;

  if (ctx.dryRun) {
    const fallbackEvents = (
      await enrichFresnoFairEventsWithDetails({
        events: base.events,
        userAgent: ctx.userAgent,
        sourceKey,
        dryRun: true,
        ...(ctx.signal ? { signal: ctx.signal } : {})
      })
    ).events;

    return {
      ...base,
      events: fallbackEvents,
      debug: {
        ...base.debug,
        detailUrlsPlanned,
        note: "dry-run — detail pages fetched on promote"
      }
    };
  }

  const enriched = await enrichFresnoFairEventsWithDetails({
    events: base.events,
    userAgent: ctx.userAgent,
    sourceKey,
    venueLabel: config.label,
    ...(ctx.signal ? { signal: ctx.signal } : {})
  });

  if (enriched.detailUrlsVisited > 0) {
    const pricedCount = enriched.events.filter(
      (event) =>
        typeof event.priceMin === "number" ||
        typeof event.priceMax === "number" ||
        Boolean(event.priceNotes?.trim())
    ).length;
    console.log(
      `[ingest] ${config.label}: ${enriched.detailUrlsVisited} detail page(s), ${pricedCount}/${enriched.events.length} events with pricing`
    );
  }

  return {
    events: enriched.events,
    errors: [...base.errors, ...enriched.errors],
    listingUrlsFound: base.listingUrlsFound,
    detailUrlsVisited: enriched.detailUrlsVisited,
    llmCalls: base.llmCalls,
    debug: {
      ...base.debug,
      fetchUrls: [...(base.debug?.fetchUrls ?? []), ...enriched.fetchUrls],
      detailUrls: enriched.fetchUrls,
      detailUrlsPlanned
    }
  };
}

export { config };
