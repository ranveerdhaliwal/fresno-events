import { eventCategories, resolveVenueLocationFields, type EventCategory, type NormalizedEvent } from "@fresno-events/shared";
import type { CheerioAPI } from "cheerio";
import { load } from "cheerio";
import type { Element } from "domhandler";

import type { AiDiscoveryItem } from "@/ai";
import { instantFromPacificLocal } from "@/lib/pacific-instant.utils";

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

const ALLOWED_CATEGORIES: ReadonlySet<string> = new Set(eventCategories);

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

/** `T12:00:00Z` (noon UTC) is the documented Downtown all-day sentinel (see pacific-instant.utils). */
function downtownAllDaySentinel(dateIso: string): string {
  return new Date(`${dateIso}T12:00:00Z`).toISOString();
}

/** BBQ `lnk-secondary` values: `7pm / Warnors`, `10am - 3pm`, or venue-only `Fulton 55`. */
const DOWNTOWN_TIME_ONLY_RE =
  /^\d{1,2}(?::\d{2})?\s*(?:am|pm)(?:\s*-\s*\d{1,2}(?::\d{2})?\s*(?:am|pm))?$/i;

export function looksLikeDowntownTimeOnly(text: string): boolean {
  return DOWNTOWN_TIME_ONLY_RE.test(text.trim());
}

export function parseDowntownSecondary(secondary: string): { timePart: string; venuePart: string | null } {
  const normalized = secondary.replace(/\s+/g, " ").trim();
  if (!normalized) {
    return { timePart: "", venuePart: null };
  }

  const slashIdx = normalized.indexOf("/");
  if (slashIdx >= 0) {
    return {
      timePart: normalized.slice(0, slashIdx).trim(),
      venuePart: normalized.slice(slashIdx + 1).trim() || null
    };
  }

  if (looksLikeDowntownTimeOnly(normalized)) {
    return { timePart: normalized, venuePart: null };
  }

  return { timePart: "", venuePart: normalized };
}

function isPlausibleVenueName(text: string): boolean {
  const trimmed = text.trim();
  if (!trimmed || trimmed.length > 80) {
    return false;
  }
  if (/[.!?]\s/.test(trimmed)) {
    return false;
  }
  if (/\btakes place\b/i.test(trimmed) || /\bat the\b/i.test(trimmed)) {
    return false;
  }
  return true;
}

function parseDowntownDetailLocation($: CheerioAPI): { venueName: string | null; venueAddress: string | null } {
  const locationHeading = $("h2.on-detail").filter(
    (_, el) => $(el).text().trim().toLowerCase() === "location"
  );
  if (locationHeading.length === 0) {
    return { venueName: null, venueAddress: null };
  }

  const paragraph = locationHeading.first().next(".awesome-box").find(".awesome-box-link p").first();
  if (paragraph.length === 0) {
    return { venueName: null, venueAddress: null };
  }

  const anchorName = paragraph.find("a").first().text().replace(/\s+/g, " ").trim();
  const html = paragraph.html() ?? "";
  const lines = html
    .split(/<br\s*\/?>/i)
    .map((fragment) => load(`<span>${fragment}</span>`)("span").text().replace(/\s+/g, " ").trim())
    .filter(Boolean);

  if (lines.length === 0) {
    return { venueName: null, venueAddress: null };
  }

  if (anchorName) {
    const addressLine = lines.find((line) => line !== anchorName) ?? null;
    return {
      venueName: isPlausibleVenueName(anchorName) ? anchorName : null,
      venueAddress: addressLine
    };
  }

  const firstLine = lines[0] ?? "";
  const dashSplit = firstLine.match(/^(.+?)\s*[–—-]\s*(.+,\s*[A-Za-z]{2}(?:\s+\d{5}(?:-\d{4})?)?)\s*$/);
  if (dashSplit) {
    const venueName = dashSplit[1].trim();
    return {
      venueName: isPlausibleVenueName(venueName) ? venueName : null,
      venueAddress: dashSplit[2].trim()
    };
  }

  return {
    venueName: isPlausibleVenueName(firstLine) ? firstLine : null,
    venueAddress: lines[1] ?? null
  };
}

function isGenericDowntownMetaDescription(text: string, title: string): boolean {
  const normalized = text.replace(/\s+/g, " ").trim();
  if (!normalized) {
    return true;
  }
  if (/ \| Downtown Fresno$/i.test(normalized)) {
    return true;
  }
  const titleKey = title.replace(/\s+/g, " ").trim().toLowerCase();
  if (titleKey && normalized.toLowerCase() === `${titleKey} | downtown fresno`) {
    return true;
  }
  return false;
}

function downtownDetailBlockText($: CheerioAPI, el: Element): string | null {
  const tag = el.tagName?.toLowerCase();
  if (tag === "p") {
    const text = $(el).text().replace(/\s+/g, " ").trim();
    return text || null;
  }
  if (tag === "h3") {
    const text = $(el).text().replace(/\s+/g, " ").trim();
    return text || null;
  }
  if (tag === "h2") {
    const $el = $(el);
    if ($el.hasClass("on-detail")) {
      return null;
    }
    const text = $el.text().replace(/\s+/g, " ").trim();
    return text || null;
  }
  if (tag === "ul" || tag === "ol") {
    const items: string[] = [];
    $(el)
      .children("li")
      .each((_, li) => {
        const text = $(li).text().replace(/\s+/g, " ").trim();
        if (text) {
          items.push(`• ${text}`);
        }
      });
    return items.length > 0 ? items.join("\n") : null;
  }
  return null;
}

/** Prefer the on-page Details block over generic `Title | Downtown Fresno` meta tags. */
export function parseDowntownDetailDescription($: CheerioAPI, title: string): string | null {
  const detailsHeading = $("h2.on-detail").filter(
    (_, el) => $(el).text().trim().toLowerCase() === "details"
  );
  if (detailsHeading.length > 0) {
    const blocks: string[] = [];
    let sibling = detailsHeading.first().next();
    while (sibling.length > 0) {
      const plain = sibling.text().replace(/\s+/g, " ").trim();
      if (plain.toLowerCase().includes("subscribe to our newsletter")) {
        break;
      }

      for (const el of sibling.toArray()) {
        const block = downtownDetailBlockText($, el);
        if (block) {
          blocks.push(block);
        }
      }

      sibling = sibling.next();
    }
    if (blocks.length > 0) {
      return blocks.join("\n\n").slice(0, 4000);
    }
  }

  const metaDescription =
    $('meta[property="og:description"]').attr("content")?.trim() ||
    $('meta[name="description"]').attr("content")?.trim() ||
    null;
  if (metaDescription && !isGenericDowntownMetaDescription(metaDescription, title)) {
    return metaDescription.slice(0, 4000);
  }

  const entryText = $(".entry-content").first().text().replace(/\s+/g, " ").trim();
  if (entryText && !isGenericDowntownMetaDescription(entryText, title)) {
    return entryText.slice(0, 4000);
  }

  return null;
}

function parseDowntownDetailDateIso(dateText: string, ref: Date): string | null {
  const match = dateText.match(/\b([A-Za-z]+)\s+(\d{1,2}),\s*(\d{4})\b/);
  if (!match) {
    return null;
  }
  return parseMonthDay(match[1], match[2], ref);
}

function parseTimeOnDate(dateIso: string, timePart: string): string | null {
  const match = timePart.match(/(\d{1,2})(?::(\d{2}))?\s*(am|pm)/i);
  const meridiem = match?.[3];
  if (!match || !meridiem) {
    return downtownAllDaySentinel(dateIso);
  }

  let hour = Number(match[1]);
  const minute = match[2] ? Number(match[2]) : 0;
  const meridiemLower = meridiem.toLowerCase();
  if (meridiemLower === "pm" && hour < 12) hour += 12;
  if (meridiemLower === "am" && hour === 12) hour = 0;

  // The listing time is a Pacific wall-clock value, not UTC — anchor it to America/Los_Angeles.
  const hhmm = `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
  return instantFromPacificLocal(dateIso, hhmm) ?? downtownAllDaySentinel(dateIso);
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
      const { timePart, venuePart } = parseDowntownSecondary(item.secondary);
      const startTs = parseTimeOnDate(dateIso, timePart);

      events.push({
        source: "api:downtownfresno",
        sourceEventId,
        title: item.title,
        venueName: venuePart || "Downtown Fresno",
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

function absoluteDowntownUrl(src: string): string {
  if (src.startsWith("http://") || src.startsWith("https://")) {
    return src;
  }
  return new URL(src, EVENT_BASE).toString();
}

function isDowntownEventImageUrl(src: string): boolean {
  try {
    const url = new URL(src, EVENT_BASE);
    const path = url.pathname.toLowerCase();
    if (path.includes("favicon") || path.includes("apple-touch")) {
      return false;
    }
    if (url.hostname.includes("img.ctykit.com")) {
      return true;
    }
    return /\.(jpe?g|png|webp|gif)(?:$|\?)/i.test(path);
  } catch {
    return false;
  }
}

/** CityLight detail pages use carousel heroes; og:image is usually absent. */
export function resolveDowntownDetailImage($: CheerioAPI): string | null {
  const ogImage = $('meta[property="og:image"]').attr("content")?.trim();
  if (ogImage && isDowntownEventImageUrl(ogImage)) {
    return absoluteDowntownUrl(ogImage);
  }

  const carouselSelectors = [
    ".carousel-item.active img[src]",
    ".carousel img[src]",
    ".entry-content img[src]"
  ];
  for (const selector of carouselSelectors) {
    const src = $(selector).first().attr("src")?.trim();
    if (src && isDowntownEventImageUrl(src)) {
      return absoluteDowntownUrl(src);
    }
  }

  return null;
}

export function parseDowntownDetailTicketUrl($: CheerioAPI): string | null {
  const href =
    $("a.btn-brand-pill[href]")
      .filter((_, el) => $(el).text().trim().toLowerCase().includes("visit website"))
      .first()
      .attr("href")
      ?.trim() ??
    $('a[href*="ticket"], a:contains("Visit Website"), a:contains("Buy Tickets")')
      .first()
      .attr("href")
      ?.trim();

  if (!href || !href.startsWith("http")) {
    return null;
  }

  return href;
}

export function parseDowntownDetailHtml(html: string, listing: NormalizedEvent, now = new Date()): NormalizedEvent {
  const $ = load(html);
  const descriptionText = parseDowntownDetailDescription($, listing.title) ?? undefined;
  const imageUrl = resolveDowntownDetailImage($);
  const location = parseDowntownDetailLocation($);
  const ticketUrl = parseDowntownDetailTicketUrl($);
  const detailDate = $(".dldate").first().text().trim();
  const detailTime = $(".dltime").first().text().trim();
  const dateIso = detailDate ? parseDowntownDetailDateIso(detailDate, now) : null;
  const startTs =
    dateIso && detailTime
      ? parseTimeOnDate(dateIso, detailTime.split("-")[0]?.trim() ?? detailTime)
      : null;

  const patch: Partial<NormalizedEvent> = {
    ...(descriptionText ? { descriptionText } : {}),
    ...(imageUrl ? { imageUrl } : {}),
    ...(ticketUrl ? { ticketUrl } : {}),
    ...(location.venueName ? { venueName: location.venueName } : {}),
    ...(startTs ? { startTs } : {})
  };

  if (location.venueAddress) {
    const { venueAddress, venueCity } = resolveVenueLocationFields(location.venueAddress, listing.venueCity, "CA");
    if (venueAddress) {
      patch.venueAddress = venueAddress;
    }
    if (venueCity) {
      patch.venueCity = venueCity;
    }
  }

  if (Object.keys(patch).length === 0) {
    return listing;
  }

  return { ...listing, ...patch };
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
      out.push(parseDowntownDetailHtml(html, listing, new Date()));
    } catch {
      out.push(listing);
    }
  }

  return { events: out, pagesVisited };
}
