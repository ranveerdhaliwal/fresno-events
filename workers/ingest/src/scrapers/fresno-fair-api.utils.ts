import { resolveVenueLocationFields, type NormalizedEvent } from "@fresno-events/shared";
import { z } from "zod";

import { instantFromPacificLocal } from "@/lib/pacific-instant.utils";

import { applyFresnoFairPricePolicy } from "./fresno-fair-price.utils";

const FairLocationSchema = z.object({
  Name: z.string().nullish(),
  AddressLine1: z.string().nullish(),
  Latitude: z.number().nullish(),
  Longitude: z.number().nullish()
});

const FairItemSchema = z.object({
  EventID: z.number(),
  Name: z.string(),
  Date: z.string().nullish(),
  Time: z.number().nullish(),
  TimeIsSpecified: z.boolean().nullish(),
  TimeDisplay: z.string().nullish(),
  EventTimeRangeString: z.string().nullish(),
  DetailURL: z.string().nullish(),
  ImageOrVideoThumbnailWithPath: z.string().nullish(),
  ShortDescription: z.string().nullish(),
  LongDescription: z.string().nullish(),
  ExternalLink: z.string().nullish(),
  Locations: z.array(FairLocationSchema).optional()
});

const FairDaySchema = z.object({
  DateString: z.string().optional(),
  Times: z
    .array(
      z.object({
        Items: z.array(FairItemSchema).optional()
      })
    )
    .optional()
});

const FairResponseSchema = z.object({
  d: z.object({
    Days: z.array(FairDaySchema).optional()
  })
});

export const FRESNO_FAIR_API_URL =
  "https://www.fresnofair.com/services/eventsservice.asmx/GetEventDaysByList";

/** Fair season month (October) in Pacific local calendar. */
export const FRESNO_FAIR_SEASON_MONTH = 10;

/** October day count used for `GetEventDaysByList` date windows. */
export const FRESNO_FAIR_SEASON_DAY_COUNT = 31;

export function parseSeriesSeasonYear(seriesId: string | undefined): number | null {
  const match = seriesId?.match(/:(\d{4})$/);
  if (!match?.[1]) {
    return null;
  }
  const year = Number(match[1]);
  return Number.isFinite(year) ? year : null;
}

/**
 * Fair listings are keyed to the season year (e.g. Oct 2026), not always the clock year.
 * Prefer an explicit `seriesId` suffix when configured on the venue.
 */
export function resolveFresnoFairScheduleYear(now: Date, seriesId?: string): number {
  const fromSeries = parseSeriesSeasonYear(seriesId);
  if (fromSeries !== null) {
    return fromSeries;
  }
  return now.getFullYear();
}

/** Years to query when the primary season window is empty (stale seriesId, pre-season). */
export function fresnoFairScheduleYearsToTry(primaryYear: number): number[] {
  return [primaryYear, primaryYear + 1];
}

export function seriesIdForFresnoFairSeasonYear(year: number, configuredSeriesId?: string): string {
  const configuredYear = parseSeriesSeasonYear(configuredSeriesId);
  if (configuredYear === year && configuredSeriesId) {
    return configuredSeriesId;
  }
  return `series:bigfresnofair:${year}`;
}

/** Fairgrounds mailing address when the API omits `AddressLine1`. */
export const FRESNO_FAIR_DEFAULT_VENUE_ADDRESS = "1121 S. Chance Avenue, Fresno, CA 93702";

export function buildFresnoFairDateList(year: number, month: number, dayCount: number): string {
  const dates: string[] = [];
  for (let day = 1; day <= dayCount; day += 1) {
    const mm = String(month).padStart(2, "0");
    const dd = String(day).padStart(2, "0");
    dates.push(`${mm}/${dd}/${year}`);
  }
  return dates.join(",");
}

export function buildFresnoFairApiPayload(datesCsv: string): Record<string, unknown> {
  return {
    dates: datesCsv,
    day: "",
    categoryID: 0,
    tagID: 0,
    keywords: "%%",
    isFeatured: "false",
    fanPicks: "false",
    pastEvents: "false",
    allEvents: "false",
    memberEvents: "false",
    memberOnly: "false",
    showCategoryExceptionID: 0,
    isolatedSchedule: 0,
    customFieldFilters: [],
    searchInDescription: true
  };
}

function parseDotNetDate(value: string | undefined): string | null {
  if (!value) {
    return null;
  }
  const match = /\/Date\((\d+)\)\//.exec(value);
  if (!match?.[1]) {
    return null;
  }
  const ms = Number(match[1]);
  if (!Number.isFinite(ms)) {
    return null;
  }
  return new Date(ms).toISOString().slice(0, 10);
}

/** Fair `Time` is HHMM Pacific wall clock (e.g. 600 → 6:00 AM, 1900 → 7:00 PM). */
export function fairTimeToClock(time: number | undefined): string | null {
  if (time === undefined || !Number.isFinite(time) || time < 0) {
    return null;
  }

  if (time >= 100 && time <= 2359) {
    const hour = Math.floor(time / 100);
    const minute = time % 100;
    if (hour <= 23 && minute <= 59) {
      return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
    }
  }

  if (time < 1440) {
    const hour = Math.floor(time / 60);
    const minute = time % 60;
    if (hour <= 23 && minute <= 59) {
      return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
    }
  }

  return null;
}

const AM_PM = String.raw`a\.?\s*m\.?|p\.?\s*m\.?`;

function clockFromAmPm(hour12: number, minute: number, ampm: string): string {
  const normalized = ampm.toLowerCase().replace(/\./g, "").replace(/\s+/g, "");
  let hour = hour12 % 12;
  if (normalized.startsWith("p")) {
    hour += 12;
  }
  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

/** Parse fair CMS copy like "10 a.m. – 1 p.m." or "10:00 AM - 1:00 PM". */
export function parseFairTimeRangeFromText(
  text: string
): { startClock: string; endClock?: string } | null {
  const normalized = text.replace(/[\u2013\u2014]/g, "-");

  const rangeMatch = normalized.match(
    new RegExp(
      String.raw`(\d{1,2})(?::(\d{2}))?\s*(${AM_PM})\s*-\s*(\d{1,2})(?::(\d{2}))?\s*(${AM_PM})`,
      "i"
    )
  );
  if (rangeMatch) {
    return {
      startClock: clockFromAmPm(Number(rangeMatch[1]), Number(rangeMatch[2] ?? 0), rangeMatch[3]!),
      endClock: clockFromAmPm(Number(rangeMatch[4]), Number(rangeMatch[5] ?? 0), rangeMatch[6]!)
    };
  }

  const gatesOpen = normalized.match(
    new RegExp(String.raw`gates open at\s+(\d{1,2})(?::(\d{2}))?\s*(${AM_PM})`, "i")
  );
  if (gatesOpen) {
    return {
      startClock: clockFromAmPm(Number(gatesOpen[1]), Number(gatesOpen[2] ?? 0), gatesOpen[3]!)
    };
  }

  return null;
}

function fairScheduleText(item: z.infer<typeof FairItemSchema>): string {
  return [
    item.EventTimeRangeString,
    item.TimeDisplay,
    item.ShortDescription,
    item.LongDescription ? stripHtmlToText(item.LongDescription) : undefined
  ]
    .filter((value): value is string => Boolean(value?.trim()))
    .join(" ");
}

export function resolveFairEventSchedule(
  item: z.infer<typeof FairItemSchema>,
  dateYmd: string
): { startTs: string; endTs?: string } | null {
  if (item.TimeIsSpecified !== false && item.Time != null && item.Time > 0) {
    const clock = fairTimeToClock(item.Time);
    if (!clock) {
      return null;
    }
    const startTs = instantFromPacificLocal(dateYmd, clock);
    return startTs ? { startTs } : null;
  }

  const parsed = parseFairTimeRangeFromText(fairScheduleText(item));
  if (!parsed) {
    return null;
  }

  const startTs = instantFromPacificLocal(dateYmd, parsed.startClock);
  if (!startTs) {
    return null;
  }

  const endTs = parsed.endClock ? instantFromPacificLocal(dateYmd, parsed.endClock) : undefined;
  return { startTs, ...(endTs ? { endTs } : {}) };
}

function stripHtmlToText(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function fairDescriptionText(item: z.infer<typeof FairItemSchema>): string | undefined {
  const short = item.ShortDescription?.trim();
  const long = item.LongDescription?.trim() ? stripHtmlToText(item.LongDescription) : undefined;

  if (long && (!short || long.length > short.length + 50)) {
    return long;
  }
  if (short) {
    return short;
  }
  return long;
}

export function fresnoFairResponseToEvents(
  json: unknown,
  opts: { seriesId?: string; listingUrl: string }
): NormalizedEvent[] {
  const parsed = FairResponseSchema.safeParse(json);
  if (!parsed.success) {
    return [];
  }

  const events: NormalizedEvent[] = [];
  const seen = new Set<string>();

  for (const day of parsed.data.d.Days ?? []) {
    const dateYmd = day.DateString
      ? (() => {
          const [mm, dd, yyyy] = day.DateString.split("/");
          return yyyy && mm && dd ? `${yyyy}-${mm.padStart(2, "0")}-${dd.padStart(2, "0")}` : null;
        })()
      : null;

    for (const slot of day.Times ?? []) {
      for (const item of slot.Items ?? []) {
        const itemDate = parseDotNetDate(item.Date ?? undefined) ?? dateYmd;
        if (!itemDate) {
          continue;
        }
        const key = `${item.EventID}:${itemDate}:${item.Time ?? 0}`;
        if (seen.has(key)) {
          continue;
        }
        seen.add(key);

        const schedule = resolveFairEventSchedule(item, itemDate);
        if (!schedule) {
          continue;
        }
        const { startTs, endTs } = schedule;
        const location = item.Locations?.[0];
        const { venueAddress, venueCity } = resolveVenueLocationFields(
          location?.AddressLine1?.trim() || FRESNO_FAIR_DEFAULT_VENUE_ADDRESS,
          "Fresno",
          "CA"
        );

        const descriptionText = fairDescriptionText(item);
        const imageUrl = item.ImageOrVideoThumbnailWithPath?.trim();
        const ticketUrl = item.ExternalLink?.trim();

        events.push(
          applyFresnoFairPricePolicy({
            source: "scrape:www.fresnofair.com",
            sourceEventId: `venue:big-fresno-fair:${item.EventID}:${itemDate}`,
            title: item.Name.trim(),
            venueName: "Big Fresno Fair",
            venueCity: venueCity ?? "Fresno",
            startTs,
            ...(endTs ? { endTs } : {}),
            category: "festival",
            externalUrl: item.DetailURL ?? opts.listingUrl,
            ...(descriptionText ? { descriptionText } : {}),
            ...(imageUrl?.startsWith("http") ? { imageUrl } : {}),
            ...(ticketUrl?.startsWith("http") ? { ticketUrl } : {}),
            ...(venueAddress ? { venueAddress } : {}),
            ...(location?.Latitude != null ? { venueLat: location.Latitude } : {}),
            ...(location?.Longitude != null ? { venueLng: location.Longitude } : {}),
            ...(opts.seriesId ? { seriesId: opts.seriesId, seriesName: "Big Fresno Fair" } : {})
          })
        );
      }
    }
  }

  return events;
}
