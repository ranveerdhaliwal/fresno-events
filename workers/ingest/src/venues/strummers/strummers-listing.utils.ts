import type { NormalizedEvent } from "@fresno-events/shared";
import { load } from "cheerio";

import { instantFromPacificLocal } from "@/lib/pacific-instant.utils";
import { canonicalStrummersShowUrl } from "@/venues/_shared/link-discover.utils";
import { warnIfSelectorEmpty } from "@/venues/_shared/selector-observability.utils";
import type { VenueConfig } from "@/venues/venue.types";

function sourceHost(config: VenueConfig): string {
  return (config.sourceHostname ?? "www.strummersclub.com").replace(/^www\./, "");
}

/** Squarespace event list uses narrow no-break space before AM/PM. */
export function parseWallClock12hr(raw: string): string | null {
  const normalized = raw.replace(/\u202f/g, " ").trim();
  const match = normalized.match(/^(\d{1,2}):(\d{2})\s*(am|pm)$/i);
  if (!match?.[1] || !match[2] || !match[3]) {
    return null;
  }

  let hour = Number(match[1]);
  const minute = Number(match[2]);
  const meridiem = match[3].toLowerCase();
  if (hour > 12 || minute > 59) {
    return null;
  }

  if (meridiem === "pm" && hour < 12) {
    hour += 12;
  }
  if (meridiem === "am" && hour === 12) {
    hour = 0;
  }

  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

export function parseStrummersEventStartTs(
  dateYmd: string,
  time12hr: string
): string | null {
  const timeHHmm = parseWallClock12hr(time12hr);
  if (!timeHHmm) {
    return null;
  }
  return instantFromPacificLocal(dateYmd, timeHHmm);
}

/** Squarespace `eventlist-event` cards on /shows (SSR HTML). */
export function parseStrummersListingHtml(html: string, config: VenueConfig): NormalizedEvent[] {
  const $ = load(html);
  const listingUrl = config.listingUrl;
  const host = sourceHost(config);
  const byKey = new Map<string, NormalizedEvent>();

  const $articles = $("article.eventlist-event");
  warnIfSelectorEmpty({ venueKey: config.key, selector: "article.eventlist-event", matched: $articles.length });

  $articles.each((_, articleEl) => {
    const article = $(articleEl);
    const title = article.find("h1.eventlist-title a.eventlist-title-link").first().text().trim();
    if (!title) {
      return;
    }

    const href =
      article.find("h1.eventlist-title a.eventlist-title-link").first().attr("href")?.trim() ||
      article.find("a.eventlist-button").first().attr("href")?.trim();
    if (!href) {
      return;
    }

    const externalUrl = canonicalStrummersShowUrl(new URL(href, listingUrl).href);
    if (!externalUrl) {
      return;
    }

    const dateYmd = article.find("time.event-date").first().attr("datetime")?.trim();
    if (!dateYmd || !/^\d{4}-\d{2}-\d{2}$/.test(dateYmd)) {
      return;
    }

    const time12hr =
      article.find("time.event-time-12hr-start").first().text().trim() ||
      article.find(".eventlist-datetag-time .event-time-12hr").first().text().trim();
    const startTs = parseStrummersEventStartTs(dateYmd, time12hr);
    if (!startTs) {
      return;
    }

    const endTime12hr = article.find("time.event-time-12hr-end").first().text().trim();
    const endTs = endTime12hr ? parseStrummersEventStartTs(dateYmd, endTime12hr) : null;

    const imageRaw =
      article.find("img.eventlist-thumbnail").first().attr("src")?.trim() ||
      article.find("img.eventlist-thumbnail").first().attr("data-src")?.trim();
    let imageUrl: string | undefined;
    if (imageRaw) {
      try {
        imageUrl = new URL(imageRaw, listingUrl).href;
      } catch {
        imageUrl = imageRaw;
      }
    }

    const descriptionText = article.find(".eventlist-excerpt").first().text().trim() || undefined;
    const venueLine = article.find(".eventlist-meta-address").first().clone().children().remove().end().text().trim();

    const event: NormalizedEvent = {
      source: `scrape:${host}`,
      sourceEventId: externalUrl,
      title,
      venueName: venueLine || config.label,
      venueCity: "Fresno",
      startTs,
      ...(endTs ? { endTs } : {}),
      timezone: "America/Los_Angeles",
      externalUrl,
      category: "music",
      ...(imageUrl ? { imageUrl } : {}),
      ...(descriptionText ? { descriptionText } : {})
    };

    byKey.set(externalUrl, event);
  });

  return [...byKey.values()];
}
