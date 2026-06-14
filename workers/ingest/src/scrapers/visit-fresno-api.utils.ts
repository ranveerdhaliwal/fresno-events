import { isValidCoordinate, resolveVenueLocationFields, type NormalizedEvent } from "@fresno-events/shared";

import {
  dateOnlyStartTs,
  getPacificDateTimeParts,
  instantFromPacificLocal,
  isVisitFresnoEndOfDayUtc
} from "@/lib/pacific-instant.utils";
import { formatVisitFresnoDescriptionHtml } from "@/scrapers/visit-fresno-detail.utils";
import type { VisitFresnoDoc, VisitFresnoResponse } from "./visit-fresno-api.types";
import { buildVisitFresnoSourceEventId } from "./visit-fresno-source-id.utils";

const PACIFIC = "America/Los_Angeles";

const ENDPOINT =
  "https://www.visitfresnocounty.org/includes/rest_v2/plugins_events_events_by_date/find/";

export const VISIT_FRESNO_EVENTS_ENDPOINT = ENDPOINT;
export const VISIT_FRESNO_SIMPLE_TOKEN_URL =
  "https://www.visitfresnocounty.org/plugins/core/get_simple_token/";
export const VISIT_FRESNO_CALENDAR_URL = "https://www.visitfresnocounty.org/events/calendar-of-events/";

export function parseVisitFresnoSimpleTokenBody(body: string): string | null {
  const trimmed = body.trim();
  if (/^[a-f0-9]{32}$/i.test(trimmed)) {
    return trimmed;
  }

  try {
    const parsed: unknown = JSON.parse(trimmed);
    if (typeof parsed === "object" && parsed !== null) {
      const record = parsed as Record<string, unknown>;
      const candidate = record.token ?? record.simpleToken;
      if (typeof candidate === "string" && candidate.trim()) {
        return candidate.trim();
      }
    }
  } catch {
    // Plain-text token only.
  }

  return null;
}

export async function fetchVisitFresnoSimpleToken(opts: {
  userAgent: string;
  signal?: AbortSignal;
}): Promise<string | null> {
  const response = await fetch(VISIT_FRESNO_SIMPLE_TOKEN_URL, {
    headers: { "User-Agent": opts.userAgent },
    ...(opts.signal ? { signal: opts.signal } : {})
  });

  if (!response.ok) {
    return null;
  }

  return parseVisitFresnoSimpleTokenBody(await response.text());
}

/** Prefer live Simpleview token; optional env override/fallback for emergencies. */
export async function resolveVisitFresnoApiToken(opts: {
  userAgent: string;
  fallbackToken?: string | undefined;
  signal?: AbortSignal;
}): Promise<string | null> {
  const fetched = await fetchVisitFresnoSimpleToken(opts);
  if (fetched) {
    return fetched;
  }

  const fallback = opts.fallbackToken?.trim();
  return fallback || null;
}

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

/** Weekly windows + paginated `limit` keep responses small; unfiltered queries can exceed 16MB. */
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
  return formatVisitFresnoDescriptionHtml(html);
}

function parseVisitFresnoWallClock(dateYmd: string, timeHms: string): string | null {
  const segments = timeHms.split(":");
  const hour = segments[0]?.padStart(2, "0");
  const minute = (segments[1] ?? "00").padStart(2, "0");
  const second = (segments[2] ?? "00").padStart(2, "0");
  if (!hour || !/^\d{4}-\d{2}-\d{2}$/.test(dateYmd)) {
    return null;
  }

  const hhmm = `${hour}:${minute}`;
  return instantFromPacificLocal(dateYmd, hhmm);
}

/** Pacific calendar date for Visit Fresno `eventDate` (not the UTC date prefix). */
function visitFresnoPacificDateYmd(eventDate: string): string | null {
  const parsed = new Date(eventDate);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }
  return getPacificDateTimeParts(parsed).date;
}

function pacificWeekdayLong(dateYmd: string): string | null {
  const noon = instantFromPacificLocal(dateYmd, "12:00");
  if (!noon) {
    return null;
  }
  return new Intl.DateTimeFormat("en-US", { weekday: "long", timeZone: PACIFIC })
    .format(new Date(noon))
    .toLowerCase();
}

function weekdayMentioned(text: string, weekday: string): boolean {
  return text.toLowerCase().includes(weekday.slice(0, 3));
}

function parseClockToHhMm(hour: number, minute: number, ampm: string | undefined): string | null {
  let h = hour;
  const m = minute;
  if (ampm) {
    const ap = ampm.toLowerCase();
    if (ap === "pm" && h < 12) {
      h += 12;
    }
    if (ap === "am" && h === 12) {
      h = 0;
    }
  }
  if (h > 23 || m > 59) {
    return null;
  }
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

function extractFirstClock(text: string): string | null {
  const match = text.match(/(\d{1,2})(?::(\d{2}))?\s*(am|pm)\b/i);
  if (!match?.[1]) {
    return null;
  }
  const hour = Number(match[1]);
  const minute = match[2] ? Number(match[2]) : 0;
  return parseClockToHhMm(hour, minute, match[3]);
}

/** Parse human `times` when `startTime` is absent (recurring listings often only have this). */
export function parseVisitFresnoTimesField(times: string, dateYmd: string): string | null {
  const trimmed = times.trim();
  if (!trimmed) {
    return null;
  }

  const weekday = pacificWeekdayLong(dateYmd);
  if (!weekday) {
    return null;
  }

  const segments = trimmed.split(/\s+and\s+/i);
  if (segments.length > 1) {
    for (const segment of segments) {
      if (!weekdayMentioned(segment, weekday)) {
        continue;
      }
      const clock = extractFirstClock(segment);
      if (clock) {
        return clock;
      }
    }
    return null;
  }

  if (/\b(monday|tuesday|wednesday|thursday|friday|saturday|sunday)s?\b/i.test(trimmed)) {
    if (!weekdayMentioned(trimmed, weekday)) {
      return null;
    }
  }

  return extractFirstClock(trimmed);
}

/** Parse Visit Fresno `eventDate` + optional `startTime` (avoids 11:59 PM PT sentinel). */
/** CMS sometimes puts a contact phone in `location` instead of a venue name. */
export function looksLikePhoneLocation(value: string): boolean {
  const trimmed = value.trim();
  if (!trimmed) {
    return false;
  }
  const digits = trimmed.replace(/\D/g, "");
  if (digits.length < 10 || digits.length > 11) {
    return false;
  }
  return trimmed.replace(/[\d\s().+-]/g, "").length === 0;
}

/** Prefer real venue names; fall back to organizer hostname when `location` is a phone. */
export function resolveVisitFresnoVenueName(location?: string, hostname?: string): string {
  const loc = location?.trim() ?? "";
  const host = hostname?.trim() ?? "";
  if (loc && !looksLikePhoneLocation(loc)) {
    return loc;
  }
  if (host) {
    return host;
  }
  return loc || "Unknown venue";
}

function readVisitFresnoCoordinate(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function isMeaningfulCoordinatePair(lat: number, lng: number): boolean {
  return isValidCoordinate(lat) && isValidCoordinate(lng) && !(lat === 0 && lng === 0);
}

/** Visit Fresno exposes `latitude`/`longitude` and GeoJSON `loc` ([lng, lat]). */
export function readVisitFresnoCoordinates(
  raw: Pick<VisitFresnoDoc, "latitude" | "longitude" | "loc">
): { lat: number; lng: number } | null {
  const lat = readVisitFresnoCoordinate(raw.latitude);
  const lng = readVisitFresnoCoordinate(raw.longitude);
  if (lat !== null && lng !== null && isMeaningfulCoordinatePair(lat, lng)) {
    return { lat, lng };
  }

  const coords = raw.loc?.coordinates;
  if (coords && coords.length >= 2) {
    const lngFromLoc = readVisitFresnoCoordinate(coords[0]);
    const latFromLoc = readVisitFresnoCoordinate(coords[1]);
    if (latFromLoc !== null && lngFromLoc !== null && isMeaningfulCoordinatePair(latFromLoc, lngFromLoc)) {
      return { lat: latFromLoc, lng: lngFromLoc };
    }
  }

  return null;
}

export function parseVisitFresnoStartTs(raw: VisitFresnoDoc): string | null {
  return resolveVisitFresnoStartMeta(raw)?.startTs ?? null;
}

export function resolveVisitFresnoStartMeta(
  raw: VisitFresnoDoc
): { startTs: string; timeUnknown: boolean } | null {
  const eventDate = raw.dates.eventDate;
  if (!eventDate) {
    return null;
  }

  const dateYmd = visitFresnoPacificDateYmd(eventDate);
  if (!dateYmd) {
    return null;
  }

  const startTime = raw.startTime?.trim();
  if (startTime) {
    const wall = parseVisitFresnoWallClock(dateYmd, startTime);
    if (wall) {
      return { startTs: wall, timeUnknown: false };
    }
  }

  const timesClock = raw.times?.trim() ? parseVisitFresnoTimesField(raw.times, dateYmd) : null;
  if (timesClock) {
    const wall = instantFromPacificLocal(dateYmd, timesClock);
    if (wall) {
      return { startTs: wall, timeUnknown: false };
    }
  }

  if (isVisitFresnoEndOfDayUtc(eventDate)) {
    const ts = dateOnlyStartTs(dateYmd);
    return ts ? { startTs: ts, timeUnknown: true } : null;
  }

  const parsed = new Date(eventDate);
  return Number.isNaN(parsed.getTime()) ? null : { startTs: parsed.toISOString(), timeUnknown: false };
}

export function parseVisitFresnoEndTs(raw: VisitFresnoDoc): string | null {
  const eventDate = raw.dates.eventDate;
  if (!eventDate) {
    return null;
  }

  const dateYmd = visitFresnoPacificDateYmd(eventDate);
  if (!dateYmd) {
    return null;
  }

  const endTime = raw.endTime?.trim();
  if (!endTime) {
    return null;
  }

  return parseVisitFresnoWallClock(dateYmd, endTime);
}

export function toNormalizedEvent(raw: VisitFresnoDoc): NormalizedEvent | null {
  const schedule = resolveVisitFresnoStartMeta(raw);
  if (!raw.title || !schedule) {
    return null;
  }

  const startIso = schedule.startTs;
  const endFromApi = parseVisitFresnoEndTs(raw);

  const venueName = resolveVisitFresnoVenueName(raw.location, raw.hostname);
  const imageUrl = raw.media_raw?.find((m) => m.mediaurl)?.mediaurl;
  const coordinates = readVisitFresnoCoordinates(raw);

  const { venueAddress: resolvedAddress, venueCity: resolvedCity } = resolveVenueLocationFields(
    raw.address1,
    raw.city,
    raw.state
  );
  const venueCity = resolvedCity || "Fresno";
  const venueAddress = resolvedAddress ?? undefined;
  const descriptionText = raw.description ? stripHtml(raw.description) : undefined;
  const externalUrl = raw.absoluteUrl ?? raw.linkUrl;
  const recurrence = raw.recurrence?.trim();
  const presentedBy = raw.hostname?.trim();

  return {
    source: "api:visitfresnocounty",
    // `recid` is a series/listing id (many occurrences share it); `_id` can rotate on CMS re-publish.
    sourceEventId: buildVisitFresnoSourceEventId(raw, startIso),
    title: raw.title,
    venueName,
    venueCity,
    startTs: startIso,
    ...(schedule.timeUnknown ? { timeUnknown: true } : {}),
    ...(endFromApi ? { endTs: endFromApi } : {}),
    ...(raw.recid ? { seriesListingRecId: String(raw.recid) } : {}),
    ...(recurrence ? { seriesName: recurrence } : {}),
    ...(presentedBy && presentedBy !== venueName ? { seriesPresentedBy: presentedBy } : {}),
    ...(venueAddress ? { venueAddress } : {}),
    ...(coordinates ? { venueLat: coordinates.lat, venueLng: coordinates.lng } : {}),
    ...(descriptionText ? { descriptionText } : {}),
    ...(externalUrl ? { externalUrl } : {}),
    ...(imageUrl ? { imageUrl } : {})
  };
}
