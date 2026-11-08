import type { ScraperRun } from "@fresno-events/shared";
import { load } from "cheerio";
import type { IngestEnv } from "@/env";
import { runApiVenue } from "@/venues/_shared/api-venue.run";
import type { VenueConfig, VenueRunContext } from "@/venues/venue.types";
import { parsePhilharmonicListing } from "./philharmonic-events.utils";
import venues from "./venues.json";
import configJson from "./venue.config.json";

export const config = configJson as VenueConfig;

export const scrape: ScraperRun = async ctx => {
  const started = performance.now();
  const fetchUrls = [config.listingUrl];
  const errors: { source: string; message: string; recoverable: boolean }[] = [];
  const events: ReturnType<typeof parsePhilharmonicListing> = [];
  try {
    const response = await fetch(config.listingUrl, { headers: { "User-Agent": ctx.userAgent }, signal: ctx.signal ?? null });
    if (!response.ok) throw new Error(`Philharmonic listing HTTP ${response.status}`);
    const listings = parsePhilharmonicListing(await response.text(), venues, ctx.now);
    const detailCache = new Map<string, { descriptionText: string; imageUrl?: string; ticketUrl?: string }>();
    for (const event of listings) {
      const url = event.externalUrl!;
      if (!detailCache.has(url)) {
        fetchUrls.push(url);
        const detailResponse = await fetch(url, { headers: { "User-Agent": ctx.userAgent }, signal: ctx.signal ?? null });
        if (!detailResponse.ok) {
          errors.push({ source: config.key, message: `Philharmonic detail HTTP ${detailResponse.status}`, recoverable: true });
          events.push(event);
          continue;
        }
        const $ = load(await detailResponse.text());
        const ticketUrl = $("a.events-btn").filter((_, el) => /buy tickets/i.test($(el).text())).first().attr("href");
        const imageUrl = $('meta[property="og:image"]').attr("content") ?? event.imageUrl;
        detailCache.set(url, {
          descriptionText: $(".event-description").first().text().trim(),
          ...(imageUrl ? { imageUrl } : {}),
          ...(ticketUrl?.startsWith("https://") ? { ticketUrl } : {})
        });
      }
      events.push({ ...event, ...detailCache.get(url) });
    }
  } catch (error) {
    if (ctx.signal?.aborted) throw error;
    errors.push({ source: config.key, message: error instanceof Error ? error.message : String(error), recoverable: true });
  }
  return { source: config.key, runId: ctx.runId, events, errors, metrics: { pagesVisited: fetchUrls.length, fetchUrls, durationMs: Math.round(performance.now() - started) } };
};

export const run = (env: IngestEnv, ctx: VenueRunContext) => runApiVenue(env, config, ctx, scrape);
