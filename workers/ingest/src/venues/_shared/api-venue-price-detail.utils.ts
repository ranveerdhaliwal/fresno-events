import type { NormalizedEvent } from "@fresno-events/shared";

import { hasUsablePrice } from "@/candidates/linked-price.utils";
import { sleep } from "@/lib/sleep";
import type { VenueConfig } from "@/venues/venue.types";
import { resolveDetailMode } from "@/venues/venue-profile.utils";

import { enrichEventWithTicketSiteDetail } from "@/scrapers/ticket-site-detail.utils";

import { DETAIL_DELAY_MS, fetchListingHtml, hostAllowed, mergeListingWithDetail } from "./listing-detail.utils";
import { parsePlainHtmlDetailPage } from "./html-detail.utils";

const DEFAULT_DETAIL_CAP = 40;

function parseVenueDetailPage(html: string, pageUrl: string, config: VenueConfig) {
  return parsePlainHtmlDetailPage(html, pageUrl, config.label);
}

export interface ApiVenuePriceDetailResult {
  events: NormalizedEvent[];
  detailUrlsVisited: number;
}

/**
 * For API listing venues (e.g. Save Mart), fetch each event's venue detail page and
 * merge JSON-LD / HTML price fields when the listing API omitted them.
 */
export async function enrichApiVenueEventsWithDetailPrices(
  events: NormalizedEvent[],
  config: VenueConfig,
  userAgent: string,
  opts: { signal?: AbortSignal; detailCap?: number } = {}
): Promise<ApiVenuePriceDetailResult> {
  if (resolveDetailMode(config) !== "plain_html") {
    return { events, detailUrlsVisited: 0 };
  }

  const cap = opts.detailCap ?? config.detailUrlCap ?? DEFAULT_DETAIL_CAP;
  const bySourceEventId = new Map(events.map((event) => [event.sourceEventId, event]));
  let detailUrlsVisited = 0;

  for (const listing of events) {
    if (opts.signal?.aborted) {
      throw new DOMException("Ingest aborted", "AbortError");
    }
    if (detailUrlsVisited >= cap) {
      break;
    }
    if (hasUsablePrice(listing)) {
      continue;
    }

    const detailUrl = listing.externalUrl?.trim();
    if (!detailUrl?.startsWith("http") || !hostAllowed(detailUrl, config)) {
      continue;
    }

    detailUrlsVisited += 1;
    try {
      const html = await fetchListingHtml(detailUrl, userAgent, opts.signal);
      const parsed = parseVenueDetailPage(html, detailUrl, config);
      if (!parsed) {
        continue;
      }
      let merged = mergeListingWithDetail(listing, parsed);
      merged = await enrichEventWithTicketSiteDetail(merged, userAgent, {
        ...(opts.signal ? { signal: opts.signal } : {})
      });
      if (!hasUsablePrice(merged)) {
        continue;
      }
      bySourceEventId.set(listing.sourceEventId, merged);
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") {
        throw error;
      }
      console.log(
        JSON.stringify({
          event: "venue_ingest",
          venue_key: config.key,
          step: "api_price_detail_failed",
          url: detailUrl,
          message: error instanceof Error ? error.message : String(error)
        })
      );
    }

    await sleep(DETAIL_DELAY_MS);
  }

  return {
    events: [...bySourceEventId.values()],
    detailUrlsVisited
  };
}
