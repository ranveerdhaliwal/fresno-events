import type { NormalizedEvent } from "@fresno-events/shared";
import { z } from "zod";

import { getPacificDateTimeParts, instantFromPacificLocal } from "@/lib/pacific-instant.utils";

const SaveMartMediaSchema = z.object({
  mediaurl: z.string().optional()
});

const SaveMartDocSchema = z.object({
  recid: z.union([z.string(), z.number()]).optional(),
  title: z.string().optional(),
  url: z.string().optional(),
  linkUrl: z.string().optional(),
  date: z.union([z.string(), z.record(z.unknown())]).optional(),
  startTime: z.union([z.string(), z.number()]).optional(),
  location: z.string().optional(),
  hostname: z.string().optional(),
  media_raw: z.array(SaveMartMediaSchema).optional(),
  _media: z.array(SaveMartMediaSchema).optional()
});

const SaveMartNestedDocsSchema = z.object({
  count: z.number().optional(),
  docs: z.array(SaveMartDocSchema).optional()
});

const SaveMartResponseSchema = z.object({
  docs: z.union([z.array(SaveMartDocSchema), SaveMartNestedDocsSchema]).optional(),
  count: z.number().optional()
});

export const SAVE_MART_API_PATH =
  "https://www.savemartcenter.com/includes/rest_v2/plugins_events_events_by_date/find/";

export const SAVE_MART_SIMPLE_TOKEN_URL = "https://www.savemartcenter.com/plugins/core/get_simple_token/";

export const SAVE_MART_LISTING_URL =
  "https://www.savemartcenter.com/events-tickets/?bounds=false&view=list&sort=date";

function parseMongoDate(value: unknown): string | null {
  if (typeof value === "string") {
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? null : pacificDateYmdFromInstant(d);
  }
  if (value && typeof value === "object" && "$date" in value) {
    const raw = (value as { $date?: string }).$date;
    if (typeof raw === "string") {
      const d = new Date(raw);
      return Number.isNaN(d.getTime()) ? null : pacificDateYmdFromInstant(d);
    }
  }
  return null;
}

function pacificDateYmdFromInstant(instant: Date): string {
  return getPacificDateTimeParts(instant).date;
}

/** Unwrap ticketmaster.evyy.net affiliate links to the nested ticket URL. */
export function unwrapSaveMartTicketUrl(url: string): string {
  try {
    const parsed = new URL(url);
    for (const param of ["u", "url"]) {
      const raw = parsed.searchParams.get(param);
      if (!raw?.trim()) {
        continue;
      }
      const decoded = decodeURIComponent(raw.trim());
      if (/^https?:\/\//i.test(decoded)) {
        return decoded;
      }
    }
  } catch {
    return url;
  }
  return url;
}

/**
 * Ticketmaster event URLs embed the show date in the slug: `...-07-19-2026/event/...`
 * Save Mart's API `date` field is often one Pacific calendar day ahead — prefer TM when present.
 */
export function extractTicketmasterSlugDateYmd(url: string | undefined): string | null {
  if (!url?.trim()) {
    return null;
  }

  const target = unwrapSaveMartTicketUrl(url.trim());
  const match = /-(\d{2})-(\d{2})-(\d{4})\/event\//i.exec(target);
  if (!match?.[1] || !match[2] || !match[3]) {
    return null;
  }

  const month = match[1];
  const day = match[2];
  const year = match[3];
  const ymd = `${year}-${month}-${day}`;
  return /^\d{4}-\d{2}-\d{2}$/.test(ymd) ? ymd : null;
}

function parseStartTime(value: unknown): string {
  if (typeof value === "number" && Number.isFinite(value)) {
    // HHMM wall clock (e.g. 1900 → 19:00, 730 → 07:30)
    if (value >= 100 && value <= 2359) {
      const hour = Math.floor(value / 100);
      const minute = value % 100;
      if (hour <= 23 && minute <= 59) {
        return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
      }
    }
    // Minutes since midnight (e.g. 1140 → 19:00)
    const hour = Math.floor(value / 60);
    const minute = value % 60;
    if (hour <= 23 && minute <= 59) {
      return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
    }
  }
  if (typeof value === "string") {
    const match = value.match(/^(\d{1,2}):(\d{2})/);
    if (match?.[1] && match[2]) {
      return `${match[1].padStart(2, "0")}:${match[2]}`;
    }
  }
  return "19:00";
}

export function buildSaveMartApiQuery(opts: { start: Date; end: Date; skip: number; limit: number }): Record<string, unknown> {
  return {
    filter: {
      active: true,
      calendarid: { $in: ["1"] },
      date_range: {
        start: { $date: opts.start.toISOString() },
        end: { $date: opts.end.toISOString() }
      }
    },
    options: {
      limit: opts.limit,
      skip: opts.skip,
      count: true,
      castDocs: false,
      fields: {
        _id: 1,
        location: 1,
        hostname: 1,
        date: 1,
        startTime: 1,
        startDate: 1,
        endDate: 1,
        recid: 1,
        title: 1,
        url: 1,
        linkUrl: 1,
        media_raw: 1
      },
      hooks: [],
      sort: { date: 1, startTime: 1, rank: 1, title_sort: 1 }
    }
  };
}

function resolveSaveMartImageUrl(doc: z.infer<typeof SaveMartDocSchema>): string | undefined {
  const fromMedia = doc.media_raw?.find((m) => m.mediaurl?.startsWith("http"))?.mediaurl;
  if (fromMedia) {
    return fromMedia;
  }
  return doc._media?.find((m) => m.mediaurl?.startsWith("http"))?.mediaurl;
}

function resolveSaveMartExternalUrl(doc: z.infer<typeof SaveMartDocSchema>): string {
  if (doc.url?.startsWith("http")) {
    return doc.url;
  }
  if (doc.url) {
    return `https://www.savemartcenter.com${doc.url.startsWith("/") ? "" : "/"}${doc.url}`;
  }
  return "https://www.savemartcenter.com/events-tickets/";
}

export function buildSaveMartApiUrl(query: Record<string, unknown>, token: string): string {
  const url = new URL(SAVE_MART_API_PATH);
  url.searchParams.set("json", JSON.stringify(query));
  url.searchParams.set("token", token);
  return url.href;
}

export function saveMartDocsToEvents(docs: unknown[]): NormalizedEvent[] {
  const parsed = z.array(SaveMartDocSchema).safeParse(docs);
  if (!parsed.success) {
    return [];
  }

  const events: NormalizedEvent[] = [];
  for (const doc of parsed.data) {
    const title = doc.title?.trim();
    if (!title) {
      continue;
    }
    const dateYmd =
      extractTicketmasterSlugDateYmd(doc.linkUrl?.startsWith("http") ? doc.linkUrl.trim() : undefined) ??
      parseMongoDate(doc.date);
    if (!dateYmd) {
      continue;
    }
    const startTs = instantFromPacificLocal(dateYmd, parseStartTime(doc.startTime));
    if (!startTs) {
      continue;
    }

    const recid = doc.recid !== undefined ? String(doc.recid) : title.toLowerCase().replace(/\s+/g, "-");
    const externalUrl = resolveSaveMartExternalUrl(doc);
    const imageUrl = resolveSaveMartImageUrl(doc);
    const ticketUrl = doc.linkUrl?.startsWith("http") ? doc.linkUrl.trim() : undefined;

    events.push({
      source: "scrape:www.savemartcenter.com",
      sourceEventId: `venue:save-mart:${recid}`,
      title,
      venueName: doc.location?.trim() || doc.hostname?.trim() || "Save Mart Center",
      venueCity: "Fresno",
      startTs,
      category: "community",
      externalUrl,
      ...(imageUrl ? { imageUrl } : {}),
      ...(ticketUrl ? { ticketUrl } : {})
    });
  }

  return events;
}

export function parseSaveMartApiResponse(json: unknown): { docs: unknown[]; count: number } {
  const parsed = SaveMartResponseSchema.safeParse(json);
  if (!parsed.success) {
    return { docs: [], count: 0 };
  }

  const docsField = parsed.data.docs;
  if (Array.isArray(docsField)) {
    return {
      docs: docsField,
      count: parsed.data.count ?? docsField.length
    };
  }

  if (docsField && typeof docsField === "object") {
    const nestedDocs = docsField.docs ?? [];
    return {
      docs: nestedDocs,
      count: docsField.count ?? nestedDocs.length
    };
  }

  return { docs: [], count: 0 };
}

/** Plain-text body from `/plugins/core/get_simple_token/`. */
export function parseSaveMartSimpleToken(body: string): string | null {
  const token = body.trim();
  return /^[a-f0-9]{32}$/i.test(token) ? token : null;
}

/** Fallback when token endpoint is unavailable. */
export function extractSaveMartTokenFromHtml(html: string): string | null {
  const match = html.match(/simpleToken[^a-f0-9]{0,24}([a-f0-9]{32})/i);
  return match?.[1] ?? null;
}
