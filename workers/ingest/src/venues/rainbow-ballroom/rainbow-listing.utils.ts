import type { NormalizedEvent } from "@fresno-events/shared";
import { load } from "cheerio";

import { instantFromPacificLocal } from "@/lib/pacific-instant.utils";
import type { VenueConfig } from "@/venues/venue.types";

const EVENTMANIA_PATH_DATE = /-(\d{4}-\d{2}-\d{2})\//;

function slugFromUrl(url: string): string {
  try {
    const slug = new URL(url).pathname.split("/").filter(Boolean).pop() ?? "event";
    return slug.replace(/[^a-z0-9-]+/gi, "-").slice(0, 80);
  } catch {
    return "event";
  }
}

function titleFromUrl(url: string): string {
  try {
    const parts = new URL(url).pathname.split("/").filter(Boolean);
    const slug = parts[parts.length - 2] ?? parts[parts.length - 1] ?? "event";
    return slug.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
  } catch {
    return "Event";
  }
}

/** SSR grid at https://www.rainbowballroom.com/blog-grid (eventmania ticket links). */
export function parseRainbowListingHtml(html: string, config: VenueConfig): NormalizedEvent[] {
  const $ = load(html);
  const host = (config.sourceHostname ?? "www.rainbowballroom.com").replace(/^www\./, "");
  const seen = new Set<string>();
  const events: NormalizedEvent[] = [];

  $("a[href*='eventmania.com']").each((_, el) => {
    const href = $(el).attr("href")?.trim();
    if (!href?.startsWith("http")) {
      return;
    }
    const normalized = href.replace(/\/+$/, "");
    if (seen.has(normalized)) {
      return;
    }
    seen.add(normalized);

    const cardTitle = $(el).closest("div").find("h1,h2,h3,h4,.title").first().text().trim();
    const title = cardTitle || titleFromUrl(normalized);
    const dateMatch = normalized.match(EVENTMANIA_PATH_DATE);
    const dateYmd = dateMatch?.[1];
    const startTs = dateYmd ? instantFromPacificLocal(dateYmd, "20:00") : null;
    if (!startTs) {
      return;
    }

    events.push({
      source: `scrape:${host}`,
      sourceEventId: `venue:${config.key}:${slugFromUrl(normalized)}`,
      title,
      venueName: config.label,
      venueCity: "Fresno",
      startTs,
      category: "music",
      externalUrl: normalized,
      ticketUrl: normalized
    });
  });

  return events;
}
