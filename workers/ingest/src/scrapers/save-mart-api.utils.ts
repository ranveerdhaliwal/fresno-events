import type { NormalizedEvent } from "@fresno-events/shared";
import { z } from "zod";

import { instantFromPacificLocal } from "@/lib/pacific-instant.utils";

const SaveMartDocSchema = z.object({
  recid: z.union([z.string(), z.number()]).optional(),
  title: z.string().optional(),
  url: z.string().optional(),
  date: z.union([z.string(), z.record(z.unknown())]).optional(),
  startTime: z.union([z.string(), z.number()]).optional(),
  location: z.string().optional()
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
    return Number.isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10);
  }
  if (value && typeof value === "object" && "$date" in value) {
    const raw = (value as { $date?: string }).$date;
    if (typeof raw === "string") {
      const d = new Date(raw);
      return Number.isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10);
    }
  }
  return null;
}

function parseStartTime(value: unknown): string {
  if (typeof value === "number" && Number.isFinite(value)) {
    const hour = Math.floor(value / 60);
    const minute = value % 60;
    return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
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
        date: 1,
        startTime: 1,
        startDate: 1,
        endDate: 1,
        recid: 1,
        title: 1,
        url: 1
      },
      hooks: [],
      sort: { date: 1, startTime: 1, rank: 1, title_sort: 1 }
    }
  };
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
    const dateYmd = parseMongoDate(doc.date);
    if (!dateYmd) {
      continue;
    }
    const startTs = instantFromPacificLocal(dateYmd, parseStartTime(doc.startTime));
    if (!startTs) {
      continue;
    }

    const recid = doc.recid !== undefined ? String(doc.recid) : title.toLowerCase().replace(/\s+/g, "-");
    const externalUrl = doc.url?.startsWith("http")
      ? doc.url
      : doc.url
        ? `https://www.savemartcenter.com${doc.url.startsWith("/") ? "" : "/"}${doc.url}`
        : "https://www.savemartcenter.com/events-tickets/";

    events.push({
      source: "scrape:www.savemartcenter.com",
      sourceEventId: `venue:save-mart:${recid}`,
      title,
      venueName: doc.location?.trim() || "Save Mart Center",
      venueCity: "Fresno",
      startTs,
      category: "community",
      externalUrl
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
