import type { NormalizedEvent } from "@fresno-events/shared";
import { load } from "cheerio";

import { instantFromPacificLocal } from "@/lib/pacific-instant.utils";
import type { VenueConfig } from "@/venues/venue.types";

function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

function parseShowTime12hr(raw: string): string | null {
  const match = raw.trim().match(/^(\d{1,2})(?::(\d{2}))?\s*(AM|PM)$/i);
  if (!match?.[1] || !match[3]) {
    return null;
  }
  let hour = Number(match[1]);
  const minute = match[2] ? Number(match[2]) : 0;
  const meridiem = match[3].toUpperCase();
  if (meridiem === "PM" && hour < 12) {
    hour += 12;
  }
  if (meridiem === "AM" && hour === 12) {
    hour = 0;
  }
  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

function parseDateLine(line: string, year: number): string | null {
  const range = line.match(
    /(January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{1,2})(?:\s*[-–]\s*(\d{1,2}))?,?\s*(\d{4})?/i
  );
  if (!range?.[1] || !range[2]) {
    return null;
  }
  const eventYear = range[4] ? Number(range[4]) : year;
  const monthDay = `${range[1]} ${range[2]}, ${eventYear}`;
  const parsed = new Date(`${monthDay} 12:00:00 UTC`);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }
  return parsed.toISOString().slice(0, 10);
}

function parseParagraphBlock(
  lines: string[],
  config: VenueConfig,
  host: string,
  year: number,
  listingUrl: string
): NormalizedEvent | null {
  const venueLine = lines.find((line) => /^@\s/.test(line));
  if (!venueLine) {
    return null;
  }

  const title = lines.find(
    (line) =>
      line.length > 1 &&
      !/^@\s/.test(line) &&
      !/^show time/i.test(line) &&
      !/^tickets on sale/i.test(line) &&
      !/^(january|february|march|april|may|june|july|august|september|october|november|december)/i.test(line)
  );
  if (!title) {
    return null;
  }

  const dateLine = lines.find((line) =>
    /^(january|february|march|april|may|june|july|august|september|october|november|december)/i.test(line)
  );
  const dateYmd = dateLine ? parseDateLine(dateLine, year) : null;
  if (!dateYmd) {
    return null;
  }

  const timeLine = lines.find((line) => /^show time/i.test(line));
  const timeRaw = timeLine?.split(":").slice(1).join(":").trim() ?? "";
  const timeHHmm = parseShowTime12hr(timeRaw) ?? "19:00";
  const startTs = instantFromPacificLocal(dateYmd, timeHHmm);
  if (!startTs) {
    return null;
  }

  const venueName = venueLine.replace(/^@\s*/, "").trim() || config.label;
  const slug = slugify(`${title}-${dateYmd}`);

  return {
    source: `scrape:${host}`,
    sourceEventId: `venue:${config.key}:${slug}`,
    title,
    venueName,
    venueCity: "Fresno",
    startTs,
    category: "community",
    externalUrl: listingUrl
  };
}

/** SSR listing at https://events.fresnoconventioncenter.com/ */
export function parseConventionListingHtml(html: string, config: VenueConfig, now: Date): NormalizedEvent[] {
  const $ = load(html);
  const host = (config.sourceHostname ?? "events.fresnoconventioncenter.com").replace(/^www\./, "");
  const year = now.getFullYear();
  const events: NormalizedEvent[] = [];
  const seen = new Set<string>();

  $('div[class*="cparagraph-"]').each((_, block) => {
    const lines = $(block)
      .find("p")
      .toArray()
      .map((p) => $(p).text().replace(/\s+/g, " ").trim())
      .filter(Boolean);
    const event = parseParagraphBlock(lines, config, host, year, config.listingUrl);
    if (!event || seen.has(event.sourceEventId)) {
      return;
    }
    seen.add(event.sourceEventId);
    events.push(event);
  });

  return events;
}
