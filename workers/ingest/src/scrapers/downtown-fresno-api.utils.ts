import type { EventCategory, NormalizedEvent } from "@fresno-events/shared";
import { load } from "cheerio";

import type { AiDiscoveryItem } from "@/ai";

const BBQ_ENDPOINT = "https://xapi.citylightstudio.net/_bbq/_bbq_results.php";
const EVENT_BASE = "https://www.downtownfresno.org";

/** CityLight BBQ widget — public site token (Downtown Fresno org, fid 22). */
export const DOWNTOWN_FRESNO_FID = "22";
export const DOWNTOWN_FRESNO_BBQ_KEY = "050243126";

export function fmtBbqWindowDate(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(d.getMonth() + 1)}-${pad(d.getDate())}-${String(d.getFullYear()).slice(2)}`;
}

export function buildDowntownWindows(now: Date, windowDays = 14, horizonDays = 90): string[] {
  const windows: string[] = [];
  const windowMs = windowDays * 86_400_000;
  const endHorizon = now.getTime() + horizonDays * 86_400_000;

  for (let startMs = now.getTime(); startMs < endHorizon; startMs += windowMs) {
    const start = new Date(startMs);
    const end = new Date(Math.min(startMs + windowMs - 86_400_000, endHorizon - 86_400_000));
    windows.push(`${fmtBbqWindowDate(start)}-to-${fmtBbqWindowDate(end)}`);
  }

  return windows;
}

export function buildDowntownFresnoUrl(bbqparam: string): string {
  const url = new URL(BBQ_ENDPOINT);
  url.searchParams.set("fid", DOWNTOWN_FRESNO_FID);
  url.searchParams.set("key", DOWNTOWN_FRESNO_BBQ_KEY);
  url.searchParams.set("bbqparam", bbqparam);
  return url.toString();
}

const ALLOWED_CATEGORIES = new Set<EventCategory>([
  "music",
  "comedy",
  "theater",
  "sports",
  "food_drink",
  "festival",
  "family",
  "art",
  "nightlife",
  "community",
  "outdoor",
  "wellness",
  "education"
]);

/** Prefer detail-page LLM fields; keep listing identity (sourceEventId, externalUrl). */
export function mergeListingWithDetail(
  listing: NormalizedEvent,
  detail: AiDiscoveryItem | null
): NormalizedEvent {
  if (!detail?.title?.trim() || !detail.venueName?.trim() || !detail.startTs) {
    return listing;
  }

  const start = new Date(detail.startTs);
  if (Number.isNaN(start.getTime())) {
    return listing;
  }

  const category: EventCategory =
    detail.category && ALLOWED_CATEGORIES.has(detail.category as EventCategory)
      ? (detail.category as EventCategory)
      : (listing.category ?? "community");

  return {
    ...listing,
    title: detail.title.trim(),
    venueName: detail.venueName.trim(),
    startTs: start.toISOString(),
    category,
    ...(detail.descriptionText?.trim()
      ? { descriptionText: detail.descriptionText.trim() }
      : {}),
    ...(detail.venueAddress?.trim() ? { venueAddress: detail.venueAddress.trim() } : {}),
    ...(detail.venueCity?.trim() ? { venueCity: detail.venueCity.trim() } : {}),
    ...(detail.ticketUrl?.trim() ? { ticketUrl: detail.ticketUrl.trim() } : {}),
    ...(detail.imageUrl?.trim() ? { imageUrl: detail.imageUrl.trim() } : {}),
    ...(typeof detail.priceMin === "number" ? { priceMin: detail.priceMin } : {}),
    ...(typeof detail.priceMax === "number" ? { priceMax: detail.priceMax } : {}),
    ...(listing.externalUrl ? { externalUrl: listing.externalUrl } : {}),
    ...(!listing.externalUrl && detail.externalUrl ? { externalUrl: detail.externalUrl } : {})
  };
}

interface ParsedRow {
  month: string;
  day: string;
  items: Array<{ title: string; secondary: string; href: string }>;
}

function parseMonthDay(month: string, day: string, now: Date): string | null {
  const monthIndex = new Date(`${month} 1, 2000`).getMonth();
  if (Number.isNaN(monthIndex)) {
    return null;
  }

  let year = now.getFullYear();
  const candidate = new Date(Date.UTC(year, monthIndex, Number(day)));
  if (candidate.getTime() < now.getTime() - 30 * 86_400_000) {
    year += 1;
  }

  return new Date(Date.UTC(year, monthIndex, Number(day))).toISOString().slice(0, 10);
}

function parseTimeOnDate(dateIso: string, secondary: string): string | null {
  const match = secondary.match(/(\d{1,2})(?::(\d{2}))?\s*(am|pm)/i);
  if (!match) {
    return new Date(`${dateIso}T12:00:00Z`).toISOString();
  }

  const meridiem = match[3];
  if (!meridiem) {
    return new Date(`${dateIso}T12:00:00Z`).toISOString();
  }

  let hour = Number(match[1]);
  const minute = match[2] ? Number(match[2]) : 0;
  const meridiemLower = meridiem.toLowerCase();
  if (meridiemLower === "pm" && hour < 12) hour += 12;
  if (meridiemLower === "am" && hour === 12) hour = 0;

  return new Date(`${dateIso}T${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}:00Z`).toISOString();
}

export function parseDowntownFresnoHtml(html: string, now: Date): NormalizedEvent[] {
  const $ = load(html);
  const rows: ParsedRow[] = [];

  $(".bbq-row").each((_, rowEl) => {
    const row = $(rowEl);
    const month = row.find(".bbqdate-month").first().text().trim();
    const day = row.find(".bbqdate-day").first().text().trim();
    const items: ParsedRow["items"] = [];

    row.find(".bbq-row-list li a").each((__, linkEl) => {
      const link = $(linkEl);
      const href = link.attr("href")?.trim();
      const title = link.find(".lnk-primary").first().text().trim();
      const secondary = link.find(".lnk-secondary").first().text().trim();
      if (!href || !title) return;
      items.push({ title, secondary, href });
    });

    if (month && day && items.length > 0) {
      rows.push({ month, day, items });
    }
  });

  const events: NormalizedEvent[] = [];

  for (const row of rows) {
    const dateIso = parseMonthDay(row.month, row.day, now);
    if (!dateIso) continue;

    for (const item of row.items) {
      const externalUrl = item.href.startsWith("http") ? item.href : `${EVENT_BASE}${item.href}`;
      const sourceEventId = externalUrl.replace(/\/+$/, "");
      const startTs = parseTimeOnDate(dateIso, item.secondary);

      events.push({
        source: "api:downtownfresno",
        sourceEventId,
        title: item.title,
        venueName: item.secondary.split("/").pop()?.trim() || "Downtown Fresno",
        venueCity: "Fresno",
        startTs: startTs ?? new Date(`${dateIso}T12:00:00Z`).toISOString(),
        externalUrl,
        category: "community"
      });
    }
  }

  return events;
}

const DOWNTOWN_DO_PATH = /\/do\//i;

export function isDowntownDetailUrl(url: string): boolean {
  try {
    const u = new URL(url);
    return u.hostname.includes("downtownfresno.org") && DOWNTOWN_DO_PATH.test(u.pathname);
  } catch {
    return false;
  }
}

export function parseDowntownDetailHtml(html: string, listing: NormalizedEvent): NormalizedEvent {
  const $ = load(html);
  const descriptionText =
    $('meta[property="og:description"]').attr("content")?.trim() ||
    $('meta[name="description"]').attr("content")?.trim() ||
    $(".entry-content").first().text().trim().slice(0, 4000) ||
    undefined;
  const imageUrl = $('meta[property="og:image"]').attr("content")?.trim();

  if (!descriptionText && !imageUrl) {
    return listing;
  }

  return {
    ...listing,
    ...(descriptionText ? { descriptionText } : {}),
    ...(imageUrl ? { imageUrl } : {})
  };
}

export async function enrichDowntownEventsWithPlainDetail(
  events: NormalizedEvent[],
  userAgent: string,
  signal?: AbortSignal
): Promise<{ events: NormalizedEvent[]; pagesVisited: number }> {
  const out: NormalizedEvent[] = [];
  let pagesVisited = 0;

  for (const listing of events) {
    const url = listing.externalUrl;
    if (!url || !isDowntownDetailUrl(url)) {
      out.push(listing);
      continue;
    }

    pagesVisited += 1;
    try {
      const response = await fetch(url, {
        headers: { "User-Agent": userAgent, Accept: "text/html" },
        ...(signal ? { signal } : {})
      });
      if (!response.ok) {
        out.push(listing);
        continue;
      }
      const html = await response.text();
      out.push(parseDowntownDetailHtml(html, listing));
    } catch {
      out.push(listing);
    }
  }

  return { events: out, pagesVisited };
}
