import type { NormalizedEvent } from "@fresno-events/shared";
import { load } from "cheerio";
import type { Element } from "domhandler";

import { withDefaultImageUrl } from "@/lib/default-image.utils";
import { instantFromPacificLocal } from "@/lib/pacific-instant.utils";
import { warnIfSelectorEmpty } from "@/venues/_shared/selector-observability.utils";
import { applyChaffeeVenueLocation } from "@/venues/chaffee-zoo/chaffee-venue-location.utils";
import type { VenueConfig } from "@/venues/venue.types";

export const CHAFFEE_ZOO_DEFAULT_IMAGE_URL =
  "https://fcz.org/wp-content/uploads/2025/01/FCZ_Logo_CMYK-1.png";

const SKIP_HEADING = /party like an animal|explore our venues|host a wild birthday|birthday party|get the latest|follow us/i;

const MONTH_INDEX: Record<string, number> = {
  january: 1,
  february: 2,
  march: 3,
  april: 4,
  may: 5,
  june: 6,
  july: 7,
  august: 8,
  september: 9,
  october: 10,
  november: 11,
  december: 12
};

function monthDayToYmd(monthName: string, day: number, year: number): string | null {
  const month = MONTH_INDEX[monthName.toLowerCase()];
  if (!month || day < 1 || day > 31) {
    return null;
  }
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

function decodeHtml(text: string): string {
  return text
    .replace(/&#8211;/g, "–")
    .replace(/&amp;/g, "&")
    .replace(/&nbsp;/g, " ")
    .trim();
}

function parseChaffeeDateTime(
  heading: string,
  body: string,
  year: number
): { startTs: string; endTs?: string } | null {
  const combined = `${heading} ${body}`;
  const range = combined.match(
    /(January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{1,2})(?:st|nd|rd|th)?(?:\s*[-–]\s*(\d{1,2})(?:st|nd|rd|th)?)?(?:,?\s*(\d{4}))?/i
  );
  if (!range?.[1] || !range[2]) {
    return null;
  }

  const month = range[1];
  const day = Number(range[2]);
  const eventYear = range[4] ? Number(range[4]) : year;
  const dateYmd = monthDayToYmd(month, day, eventYear);
  if (!dateYmd) {
    return null;
  }

  const timeMatch = body.match(
    /(\d{1,2}):?(\d{2})?\s*(AM|PM)(?:\s*[-–]\s*(\d{1,2}):?(\d{2})?\s*(AM|PM))?/i
  );
  if (!timeMatch?.[1] || !timeMatch[3]) {
    const noon = instantFromPacificLocal(dateYmd, "12:00");
    return noon ? { startTs: noon } : null;
  }

  const hour = Number(timeMatch[1]);
  const minute = timeMatch[2] ? Number(timeMatch[2]) : 0;
  const meridiem = timeMatch[3].toUpperCase();
  let hour24 = hour % 12;
  if (meridiem === "PM") {
    hour24 += 12;
  }
  const startTime = `${String(hour24).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
  const startTs = instantFromPacificLocal(dateYmd, startTime);
  if (!startTs) {
    return null;
  }

  if (timeMatch[4] && timeMatch[6]) {
    const endHour = Number(timeMatch[4]);
    const endMinute = timeMatch[5] ? Number(timeMatch[5]) : 0;
    const endMeridiem = timeMatch[6].toUpperCase();
    let endHour24 = endHour % 12;
    if (endMeridiem === "PM") {
      endHour24 += 12;
    }
    const endTime = `${String(endHour24).padStart(2, "0")}:${String(endMinute).padStart(2, "0")}`;
    const endTs = instantFromPacificLocal(dateYmd, endTime);
    return endTs ? { startTs, endTs } : { startTs };
  }

  return { startTs };
}

function parseTitle(heading: string): string {
  const decoded = decodeHtml(heading);
  const withoutDate = decoded.replace(/\s*[–-]\s*(January|February|March|April|May|June|July|August|September|October|November|December).*/i, "");
  return withoutDate.trim();
}

const TICKET_BOILERPLATE = /^(get tickets|tickets will be available soon)\.?$/i;

function collectParagraphsAfterHeading($: ReturnType<typeof load>, el: Element): string[] {
  const paragraphs: string[] = [];
  let sibling = $(el).next();
  while (sibling.length && !sibling.is("h3")) {
    if (sibling.is("p") || sibling.is("div")) {
      const text = sibling.text().replace(/\s+/g, " ").trim();
      if (text) {
        paragraphs.push(text);
      }
    }
    sibling = sibling.next();
  }
  return paragraphs;
}

/** Skip schedule lines and ticket CTAs — prose blocks become descriptionText. */
function isScheduleOrBoilerplateLine(text: string): boolean {
  const line = text.trim();
  if (!line || TICKET_BOILERPLATE.test(line)) {
    return true;
  }
  const hasMonth =
    /(January|February|March|April|May|June|July|August|September|October|November|December)/i.test(line);
  const hasClock = /\b\d{1,2}(?::\d{2})?\s*(?:AM|PM)\b/i.test(line);
  if (hasMonth && hasClock && line.length < 120) {
    return true;
  }
  if (/^(?:Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday)\b/i.test(line) && hasClock && line.length < 120) {
    return true;
  }
  return false;
}

function extractChaffeeDescription(paragraphs: string[]): string | undefined {
  const prose = paragraphs.map((p) => p.replace(/\s+/g, " ").trim()).filter((p) => !isScheduleOrBoilerplateLine(p));
  const joined = prose.join("\n\n").trim();
  if (joined.length < 40) {
    return undefined;
  }
  return joined;
}

/** SSR listing at https://fcz.org/events/ */
export function parseChaffeeListingHtml(html: string, config: VenueConfig, now: Date): NormalizedEvent[] {
  const $ = load(html);
  const year = now.getFullYear();
  const host = (config.sourceHostname ?? "fcz.org").replace(/^www\./, "");
  const events: NormalizedEvent[] = [];
  const seen = new Set<string>();

  const $headings = $("h3");
  warnIfSelectorEmpty({ venueKey: config.key, selector: "h3", matched: $headings.length });

  $headings.each((_, el) => {
    const heading = $(el).text().trim();
    if (!heading || SKIP_HEADING.test(heading)) {
      return;
    }

    const paragraphs = collectParagraphsAfterHeading($, el);
    const body = paragraphs.join(" ");
    const title = parseTitle(heading);
    if (!title) {
      return;
    }

    const when = parseChaffeeDateTime(heading, body, year);
    if (!when) {
      return;
    }

    const descriptionText = extractChaffeeDescription(paragraphs);

    const slug = slugify(title);
    if (seen.has(slug)) {
      return;
    }
    seen.add(slug);

    const ticketHref =
      $(el)
        .parent()
        .find('a[href*="ticketapp.org"], a:contains("GET TICKETS")')
        .first()
        .attr("href")
        ?.trim() ?? config.listingUrl;

    events.push(
      applyChaffeeVenueLocation(
        withDefaultImageUrl(
          {
            source: `scrape:${host}`,
            sourceEventId: `venue:${config.key}:${slug}`,
            title,
            ...(descriptionText ? { descriptionText } : {}),
            venueName: config.label,
            venueCity: "Fresno",
            startTs: when.startTs,
            ...(when.endTs ? { endTs: when.endTs } : {}),
            category: "family",
            externalUrl: config.listingUrl,
            ...(ticketHref.startsWith("http") ? { ticketUrl: ticketHref } : {})
          },
          CHAFFEE_ZOO_DEFAULT_IMAGE_URL,
          { showInCommunityList: true, listVenueLogoPadding: 2 }
        )
      )
    );
  });

  return events;
}
