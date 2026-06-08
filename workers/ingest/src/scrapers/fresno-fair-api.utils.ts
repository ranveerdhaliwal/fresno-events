import type { NormalizedEvent } from "@fresno-events/shared";
import { z } from "zod";

import { instantFromPacificLocal } from "@/lib/pacific-instant.utils";

const FairLocationSchema = z.object({
  Name: z.string().optional(),
  AddressLine1: z.string().optional(),
  Latitude: z.number().optional(),
  Longitude: z.number().optional()
});

const FairItemSchema = z.object({
  EventID: z.number(),
  Name: z.string(),
  Date: z.string().optional(),
  Time: z.number().optional(),
  TimeIsSpecified: z.boolean().optional(),
  TimeDisplay: z.string().optional(),
  DetailURL: z.string().optional(),
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

function pacificInstantFromFairDay(dateYmd: string, fairTime: number | undefined): string | null {
  const clock = fairTimeToClock(fairTime) ?? "19:00";
  return instantFromPacificLocal(dateYmd, clock);
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
        const itemDate = parseDotNetDate(item.Date) ?? dateYmd;
        if (!itemDate) {
          continue;
        }
        const key = `${item.EventID}:${itemDate}:${item.Time ?? 0}`;
        if (seen.has(key)) {
          continue;
        }
        seen.add(key);

        const startTs = pacificInstantFromFairDay(itemDate, item.Time);
        if (!startTs) {
          continue;
        }
        const location = item.Locations?.[0];
        const venueAddress = location?.AddressLine1?.trim();

        events.push({
          source: "scrape:www.fresnofair.com",
          sourceEventId: `venue:big-fresno-fair:${item.EventID}:${itemDate}`,
          title: item.Name.trim(),
          venueName: "Big Fresno Fair",
          venueCity: "Fresno",
          startTs,
          category: "festival",
          externalUrl: item.DetailURL ?? opts.listingUrl,
          ...(venueAddress ? { venueAddress } : {}),
          ...(location?.Latitude != null ? { venueLat: location.Latitude } : {}),
          ...(location?.Longitude != null ? { venueLng: location.Longitude } : {}),
          ...(opts.seriesId ? { seriesId: opts.seriesId, seriesName: "Big Fresno Fair" } : {})
        });
      }
    }
  }

  return events;
}
