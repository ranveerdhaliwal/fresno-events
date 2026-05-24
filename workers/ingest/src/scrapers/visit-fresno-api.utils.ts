import type { NormalizedEvent } from "@fresno-events/shared";

import type { VisitFresnoDoc, VisitFresnoResponse } from "./visit-fresno-api.types";

const ENDPOINT =
  "https://www.visitfresnocounty.org/includes/rest_v2/plugins_events_events_by_date/find/";

export function formatPacificIso(date: Date): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Los_Angeles",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false
  }).formatToParts(date);

  const get = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((p) => p.type === type)?.value ?? "00";

  return `${get("year")}-${get("month")}-${get("day")}T${get("hour")}:${get("minute")}:${get("second")}-07:00`;
}

export interface VisitFresnoDateRange {
  start: Date;
  end: Date;
}

/** Weekly windows avoid CMS 500s on deep skip pagination over a 30-day horizon. */
export function buildVisitFresnoDateRanges(now: Date, windowDays = 7, horizonDays = 30): VisitFresnoDateRange[] {
  const ranges: VisitFresnoDateRange[] = [];
  const windowMs = windowDays * 86_400_000;
  const endHorizon = now.getTime() + horizonDays * 86_400_000;

  for (let startMs = now.getTime(); startMs < endHorizon; startMs += windowMs) {
    const start = new Date(startMs);
    const end = new Date(Math.min(startMs + windowMs - 1, endHorizon));
    ranges.push({ start, end });
  }

  return ranges;
}

export function buildVisitFresnoUrl(opts: {
  token: string;
  skip: number;
  limit: number;
  range: VisitFresnoDateRange;
}): string {
  const filter = {
    filter: {
      "dates.eventDate": {
        $gte: { $date: formatPacificIso(opts.range.start) },
        $lte: { $date: formatPacificIso(opts.range.end) }
      }
    },
    options: {
      skip: opts.skip,
      limit: opts.limit,
      count: true
    }
  };

  const url = new URL(ENDPOINT);
  url.searchParams.set("json", JSON.stringify(filter));
  url.searchParams.set("token", opts.token);
  return url.toString();
}

export function extractVisitFresnoDocs(payload: VisitFresnoResponse): VisitFresnoDoc[] {
  const nested = payload.docs;
  if (Array.isArray(nested)) {
    return nested;
  }
  return nested.docs;
}

export function visitFresnoTotalCount(payload: VisitFresnoResponse): number | undefined {
  const nested = payload.docs;
  if (Array.isArray(nested)) {
    return nested.length;
  }
  return nested.count;
}

function stripHtml(html: string): string {
  return html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

export function toNormalizedEvent(raw: VisitFresnoDoc): NormalizedEvent | null {
  const startTs = raw.dates.eventDate;
  if (!raw.title || !startTs) {
    return null;
  }

  const venueName = raw.location?.trim() || "Unknown venue";
  const imageUrl = raw.media_raw?.find((m) => m.mediaurl)?.mediaurl;

  const venueAddress = raw.address1?.trim();
  const descriptionText = raw.description ? stripHtml(raw.description) : undefined;
  const externalUrl = raw.absoluteUrl ?? raw.linkUrl;

  return {
    source: "api:visitfresnocounty",
    // `recid` is a series/listing id (many occurrences share it); `_id` is unique per occurrence.
    sourceEventId: raw._id,
    title: raw.title,
    venueName,
    venueCity: raw.city?.trim() || "Fresno",
    startTs: new Date(startTs).toISOString(),
    ...(venueAddress ? { venueAddress } : {}),
    ...(descriptionText ? { descriptionText } : {}),
    ...(externalUrl ? { externalUrl } : {}),
    ...(imageUrl ? { imageUrl } : {})
  };
}
