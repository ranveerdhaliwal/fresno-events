import type { NormalizedEvent } from "@fresno-events/shared";
import { load } from "cheerio";
import { parsePlainHtmlDetailPage } from "@/venues/_shared/html-detail.utils";
import { mergeListingWithDetail } from "@/venues/_shared/listing-detail.utils";
import { readFlightRecords } from "./rainbow-flight.utils";

function findPoshPerformance(value: unknown): { startUtc: string; endUtc?: string } | null {
  if (!value || typeof value !== "object") return null;
  const record = value as Record<string, unknown>;
  if (
    typeof record.venueName === "string" &&
    /rainbow/i.test(record.venueName) &&
    typeof record.startUtc === "string" &&
    /Z$/i.test(record.startUtc) &&
    Number.isFinite(Date.parse(record.startUtc))
  ) {
    return {
      startUtc: record.startUtc,
      ...(typeof record.endUtc === "string" ? { endUtc: record.endUtc } : {})
    };
  }
  for (const child of Object.values(record)) {
    const result = findPoshPerformance(child);
    if (result) return result;
  }
  return null;
}

/** Only explicit Event JSON-LD dates may override the venue's CMS time. */
export function mergeRainbowTicketDetail(listing: NormalizedEvent, html: string): NormalizedEvent {
  const $ = load(html);
  if (listing.ticketUrl && new URL(listing.ticketUrl).hostname === "posh.vip") {
    const performance = readFlightRecords($).map(findPoshPerformance).find(Boolean);
    if (performance)
      return {
        ...listing,
        startTs: new Date(performance.startUtc).toISOString(),
        ...(performance.endUtc &&
        /Z$/i.test(performance.endUtc) &&
        Date.parse(performance.endUtc) > Date.parse(performance.startUtc)
          ? { endTs: new Date(performance.endUtc).toISOString() }
          : {})
      };
  }
  for (const script of $("script[type='application/ld+json']").toArray()) {
    try {
      const value: unknown = JSON.parse($(script).text());
      for (const raw of Array.isArray(value) ? value : [value]) {
        if (!raw || typeof raw !== "object") continue;
        const event = raw as Record<string, unknown>;
        if (!String(event["@type"]).toLowerCase().includes("event")) continue;
        const start = event.startDate;
        if (
          typeof start !== "string" ||
          !/(?:Z|[+-]\d{2}:\d{2})$/i.test(start) ||
          !Number.isFinite(Date.parse(start))
        )
          continue;
        const detail = parsePlainHtmlDetailPage(html, listing.ticketUrl!, listing.venueName);
        if (!detail || !/rainbow/i.test(detail.venueName)) continue;
        const end = event.endDate;
        return {
          ...mergeListingWithDetail(listing, detail),
          title: listing.title,
          venueName: listing.venueName,
          startTs: new Date(start).toISOString(),
          ...(typeof end === "string" &&
          /(?:Z|[+-]\d{2}:\d{2})$/i.test(end) &&
          Date.parse(end) > Date.parse(start)
            ? { endTs: new Date(end).toISOString() }
            : {})
        };
      }
    } catch {
      /* Keep the original listing if structured ticket data is malformed. */
    }
  }
  return listing;
}
