import { load, type CheerioAPI } from "cheerio";
import type { Element } from "domhandler";

import { resolveVenueLocationFields, type NormalizedEvent } from "@fresno-events/shared";

import { decodeHtmlEntities as decodeSharedHtmlEntities } from "@fresno-events/shared";

import { getPacificDateTimeParts, instantFromPacificLocal } from "@/lib/pacific-instant.utils";

function normalizeInlineWhitespace(text: string): string {
  return text.replace(/[\t\u00a0]+/g, " ").replace(/ +/g, " ").trim();
}

function decodeHtmlEntities(text: string): string {
  return decodeSharedHtmlEntities(text);
}

function formatSimpleVisitFresnoDescriptionHtml(html: string): string {
  const text = decodeHtmlEntities(html.replace(/<br\s*\/?>/gi, "\n").replace(/<[^>]+>/g, ""));
  const lines = text
    .split("\n")
    .map((line) => normalizeInlineWhitespace(line))
    .filter(Boolean);
  return lines.join("\n").trim();
}

function needsStructuredVisitFresnoDescriptionParse(html: string): boolean {
  if (/<(ul|ol|li|h[3-5])\b/i.test(html)) {
    return true;
  }
  return (html.match(/<p\b/gi)?.length ?? 0) > 1;
}

function paragraphText($: CheerioAPI, el: Element): string {
  const clone = $(el).clone();
  clone.find("br").replaceWith("\n");
  const lines = clone
    .text()
    .split("\n")
    .map((line) => normalizeInlineWhitespace(line))
    .filter(Boolean);
  return lines.join("\n");
}

function listBlockText($: CheerioAPI, el: Element): string {
  const lines: string[] = [];
  $(el)
    .children("li")
    .each((_, li) => {
      const line = normalizeInlineWhitespace($(li).text());
      if (line) {
        lines.push(line);
      }
    });
  return lines.join("\n");
}

function blockFromElement($: CheerioAPI, el: Element): string | null {
  const tag = el.tagName?.toLowerCase();
  if (!tag) {
    return null;
  }

  if (tag === "ul" || tag === "ol") {
    return listBlockText($, el) || null;
  }

  if (tag === "p" || tag === "div" || tag === "h3" || tag === "h4" || tag === "h5") {
    return paragraphText($, el) || null;
  }

  const text = normalizeInlineWhitespace($(el).text());
  return text || null;
}

/** Plain text from Visit Fresno CMS HTML — paragraphs, list lines, decoded entities. */
export function formatVisitFresnoDescriptionHtml(html: string): string {
  const trimmed = html.trim();
  if (!trimmed) {
    return "";
  }

  if (!needsStructuredVisitFresnoDescriptionParse(trimmed)) {
    return formatSimpleVisitFresnoDescriptionHtml(trimmed);
  }

  const $ = load(`<div data-vf-root>${trimmed}</div>`, null, false);
  const blocks: string[] = [];

  $("[data-vf-root]")
    .children()
    .each((_, el) => {
      const block = blockFromElement($, el);
      if (block) {
        blocks.push(block);
      }
    });

  if (blocks.length === 0) {
    return formatSimpleVisitFresnoDescriptionHtml(trimmed);
  }

  return blocks.join("\n\n").trim();
}

function descriptionFromDetailSection($: CheerioAPI): string | undefined {
  const heading = $("h2")
    .filter((_, el) => $(el).text().trim().toLowerCase() === "description")
    .first();
  if (!heading.length) {
    return undefined;
  }

  const htmlChunks: string[] = [];
  let node = heading.next();
  while (node.length && !node.is("h2")) {
    htmlChunks.push($.html(node));
    node = node.next();
  }

  if (htmlChunks.length === 0) {
    return undefined;
  }

  const formatted = formatVisitFresnoDescriptionHtml(htmlChunks.join(""));
  return formatted || undefined;
}

export interface VisitFresnoTimeRange {
  startClock: string;
  endClock: string;
}

export interface VisitFresnoDetailFields {
  descriptionText?: string;
  venueAddress?: string;
  venueName?: string;
  timeRange?: VisitFresnoTimeRange;
  priceNotes?: string;
  isFree?: boolean;
  priceMin?: number;
  priceMax?: number;
  currency?: string;
  ticketUrl?: string;
}

function readInfoListValue($: ReturnType<typeof load>, name: string): string | undefined {
  const value = $(`li[data-name="${name}"] .info-list-value`).first().text().replace(/\s+/g, " ").trim();
  return value || undefined;
}

function parseAmPmClockToken(token: string): string | null {
  const match = token.trim().match(/^(\d{1,2})(?::(\d{2}))?\s*(am|pm)$/i);
  if (!match?.[1] || !match[3]) {
    return null;
  }

  let hour = Number(match[1]);
  const minute = match[2] ? Number(match[2]) : 0;
  const meridiem = match[3].toLowerCase();
  if (meridiem === "pm" && hour < 12) {
    hour += 12;
  }
  if (meridiem === "am" && hour === 12) {
    hour = 0;
  }
  if (hour > 23 || minute > 59) {
    return null;
  }

  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

/** Parse Simpleview info-list time lines like "9:00 AM to 11:30 AM". */
export function parseVisitFresnoTimeRangeText(raw: string): VisitFresnoTimeRange | null {
  const normalized = raw.replace(/\s+/g, " ").trim();
  const match = normalized.match(
    /^(\d{1,2}(?::\d{2})?\s*(?:am|pm))\s*(?:to|-)\s*(\d{1,2}(?::\d{2})?\s*(?:am|pm))$/i
  );
  if (!match?.[1] || !match[2]) {
    return null;
  }

  const startClock = parseAmPmClockToken(match[1]);
  const endClock = parseAmPmClockToken(match[2]);
  if (!startClock || !endClock) {
    return null;
  }

  return { startClock, endClock };
}

function pacificDateYmdFromIso(iso: string): string | null {
  const instant = new Date(iso);
  if (Number.isNaN(instant.getTime())) {
    return null;
  }
  return getPacificDateTimeParts(instant).date;
}

function applyVisitFresnoTimeRange(
  listing: NormalizedEvent,
  timeRange: VisitFresnoTimeRange
): Partial<Pick<NormalizedEvent, "startTs" | "endTs" | "timeUnknown">> {
  const dateYmd = pacificDateYmdFromIso(listing.startTs);
  if (!dateYmd) {
    return {};
  }

  const startTs = instantFromPacificLocal(dateYmd, timeRange.startClock);
  const endTs = instantFromPacificLocal(dateYmd, timeRange.endClock);
  if (!startTs) {
    return {};
  }

  return {
    startTs,
    ...(endTs ? { endTs } : {}),
    timeUnknown: false
  };
}

/** Visit Fresno price info-list values that mean no admission charge. */
export function isVisitFresnoFreeAdmissionPriceText(text: string): boolean {
  const normalized = text.trim();
  if (!normalized) {
    return false;
  }

  if (/^free(?:\s+(?:entry|admission|event))?\s*\.?$/i.test(normalized)) {
    return true;
  }

  if (/^(?:no\s+(?:charge|admission(?:\s+fee)?)|complimentary(?:\s+admission)?)\s*\.?$/i.test(normalized)) {
    return true;
  }

  return /^\$0(?:\.00)?$/.test(normalized);
}

export function applyVisitFresnoFreeAdmissionFields(
  event: Pick<NormalizedEvent, "isFree" | "priceNotes" | "priceMin" | "priceMax">
): Pick<NormalizedEvent, "isFree" | "priceMin" | "priceMax"> {
  if (event.isFree === true) {
    return {};
  }

  const notes = event.priceNotes?.trim();
  if (!notes || !isVisitFresnoFreeAdmissionPriceText(notes)) {
    return {};
  }

  return { isFree: true, priceMin: 0, priceMax: 0 };
}

export function parseVisitFresnoPriceText(raw: string): Pick<
  NormalizedEvent,
  "isFree" | "priceMin" | "priceMax" | "priceNotes" | "currency"
> {
  const text = raw.trim();
  if (!text) {
    return {};
  }

  if (isVisitFresnoFreeAdmissionPriceText(text)) {
    return { isFree: true, priceMin: 0, priceMax: 0, priceNotes: text, currency: "USD" };
  }

  const range = text.match(/\$(\d+(?:\.\d{2})?)\s*[-–]\s*\$(\d+(?:\.\d{2})?)/);
  if (range?.[1] && range[2]) {
    return {
      priceMin: Number(range[1]),
      priceMax: Number(range[2]),
      currency: "USD"
    };
  }

  const single = text.match(/\$(\d+(?:\.\d{2})?)/);
  if (single?.[1]) {
    const amount = Number(single[1]);
    return { priceMin: amount, priceMax: amount, currency: "USD" };
  }

  return { priceNotes: text };
}

/** Parse Visit Fresno CMS event detail HTML (Simpleview info list). */
export function parseVisitFresnoDetailPage(html: string): VisitFresnoDetailFields | null {
  const $ = load(html);
  const title = $("h1").first().text().trim();
  if (!title) {
    return null;
  }

  const descriptionText =
    descriptionFromDetailSection($) ||
    formatVisitFresnoDescriptionHtml(
      $('meta[property="og:description"]').attr("content")?.trim() ?? ""
    ) ||
    formatVisitFresnoDescriptionHtml($('meta[name="description"]').attr("content")?.trim() ?? "") ||
    undefined;

  const venueAddress = readInfoListValue($, "address");
  const venueName = readInfoListValue($, "location");
  const timeRaw = readInfoListValue($, "time");
  const timeRange = timeRaw ? parseVisitFresnoTimeRangeText(timeRaw) : undefined;
  const priceRaw = readInfoListValue($, "price");
  const priceFields = priceRaw ? parseVisitFresnoPriceText(priceRaw) : {};

  const ticketHref =
    $('a[href*="ticket"], a:contains("Visit Website"), a:contains("Buy Tickets")')
      .first()
      .attr("href")
      ?.trim() || undefined;

  return {
    ...(descriptionText ? { descriptionText } : {}),
    ...(venueAddress ? { venueAddress } : {}),
    ...(venueName ? { venueName } : {}),
    ...(timeRange ? { timeRange } : {}),
    ...priceFields,
    ...(ticketHref?.startsWith("http") ? { ticketUrl: ticketHref } : {})
  };
}

/** Set on detail backfill when the listing page has no price info-list field. */
export const VISIT_FRESNO_PRICE_NOT_LISTED = "Not listed on detail page";

export function mergeVisitFresnoDetail(
  listing: NormalizedEvent,
  detail: VisitFresnoDetailFields | null
): NormalizedEvent {
  if (!detail) {
    return listing;
  }

  const merged: NormalizedEvent = {
    ...listing,
    ...(detail.timeRange ? applyVisitFresnoTimeRange(listing, detail.timeRange) : {}),
    ...(detail.descriptionText?.trim() && !listing.descriptionText?.trim()
      ? { descriptionText: detail.descriptionText.trim() }
      : detail.descriptionText?.trim() && detail.descriptionText.length > (listing.descriptionText?.length ?? 0)
        ? { descriptionText: detail.descriptionText.trim() }
        : {}),
    ...(detail.venueAddress?.trim()
      ? (() => {
          const { venueAddress, venueCity } = resolveVenueLocationFields(
            detail.venueAddress,
            listing.venueCity,
            "CA"
          );
          return {
            ...(venueAddress ? { venueAddress } : {}),
            ...(venueCity && venueCity !== listing.venueCity ? { venueCity } : {})
          };
        })()
      : {}),
    ...(detail.venueName?.trim() ? { venueName: detail.venueName.trim() } : {}),
    ...(detail.ticketUrl?.trim() ? { ticketUrl: detail.ticketUrl.trim() } : {}),
    ...(detail.isFree === true ? { isFree: true } : {}),
    ...(typeof detail.priceMin === "number" ? { priceMin: detail.priceMin } : {}),
    ...(typeof detail.priceMax === "number" ? { priceMax: detail.priceMax } : {}),
    ...(detail.currency ? { currency: detail.currency } : {}),
    ...(detail.priceNotes?.trim() ? { priceNotes: detail.priceNotes.trim() } : {})
  };

  return { ...merged, ...applyVisitFresnoFreeAdmissionFields(merged) };
}

/** After a successful detail-page fetch, ensure price fields exist so detail_status can complete. */
export function finalizeVisitFresnoDetailMerge(
  listing: NormalizedEvent,
  detail: VisitFresnoDetailFields
): NormalizedEvent {
  const merged = mergeVisitFresnoDetail(listing, detail);
  const hasPrice =
    merged.isFree === true ||
    typeof merged.priceMin === "number" ||
    Boolean(merged.priceNotes?.trim());
  if (hasPrice) {
    return merged;
  }
  return { ...merged, priceNotes: VISIT_FRESNO_PRICE_NOT_LISTED };
}
