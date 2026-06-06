import type { NormalizedEvent } from "@fresno-events/shared";
import { load } from "cheerio";

import { instantFromPacificLocal } from "@/lib/pacific-instant.utils";
import type { VenueConfig } from "@/venues/venue.types";

function sourceHost(config: VenueConfig): string {
  return (config.sourceHostname ?? "fulton55.com").replace(/^www\./, "");
}

function normalizeTicketUrl(href: string, listingUrl: string): string | null {
  try {
    return new URL(href, listingUrl).href.replace(/\/+$/, "");
  } catch {
    return null;
  }
}

/**
 * WFEA `datetime` values use Pacific wall clock (e.g. 8:00 pm) but often suffix `+00:00`.
 * Treat the date/time digits as America/Los_Angeles, not UTC.
 */
export function parseWfeaStartTs(datetime: string): string | null {
  const match = datetime.match(/^(\d{4}-\d{2}-\d{2})T(\d{2}):(\d{2})/);
  if (!match?.[1] || !match[2] || !match[3]) {
    return null;
  }

  return instantFromPacificLocal(match[1], `${match[2]}:${match[3]}`);
}

/** Parse Widget for Eventbrite API (WFEA) listing cards on the Fulton 55 homepage. */
export function parseFulton55ListingHtml(html: string, config: VenueConfig): NormalizedEvent[] {
  const $ = load(html);
  const listingUrl = config.listingUrl;
  const host = sourceHost(config);
  const byKey = new Map<string, NormalizedEvent>();

  $("article.wfea-venue__event").each((_, articleEl) => {
    const article = $(articleEl);
    const titleLink = article.find("h2.wfea-venue__title a").first();
    const title = titleLink.text().trim();
    if (!title) {
      return;
    }

    const ticketHref = titleLink.attr("href")?.trim();
    const ticketUrl = ticketHref ? normalizeTicketUrl(ticketHref, listingUrl) : null;
    if (!ticketUrl) {
      return;
    }

    const datetime =
      article.find("time.wfea-venue__date-time[datetime]").first().attr("datetime")?.trim() ||
      article.find("time[datetime]").first().attr("datetime")?.trim();
    if (!datetime) {
      return;
    }

    const startTs = parseWfeaStartTs(datetime);
    if (!startTs) {
      return;
    }

    const imageRaw = article.find("img.wp-post-image").first().attr("src")?.trim();
    const imageUrl = imageRaw ? normalizeTicketUrl(imageRaw, listingUrl) ?? imageRaw : undefined;

    const event: NormalizedEvent = {
      source: `scrape:${host}`,
      sourceEventId: ticketUrl,
      title,
      venueName: config.label,
      venueCity: "Fresno",
      startTs,
      timezone: "America/Los_Angeles",
      externalUrl: ticketUrl,
      ticketUrl,
      category: "music",
      ...(imageUrl ? { imageUrl } : {})
    };

    byKey.set(ticketUrl, event);
  });

  return [...byKey.values()].sort((a, b) => a.startTs.localeCompare(b.startTs));
}
