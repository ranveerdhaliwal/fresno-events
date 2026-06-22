import type { NormalizedEvent, ScrapeError } from "@fresno-events/shared";
import type { AnyNode } from "domhandler";
import { load } from "cheerio";

import { sleep } from "@/lib/sleep";
import { fetchListingHtml } from "@/venues/_shared/listing-detail.utils";
import { DETAIL_DELAY_MS } from "@/venues/_shared/listing-detail.utils";

import {
  applyFresnoFairPricePolicy,
  parseFresnoFairFreeAdmissionFromHtml
} from "./fresno-fair-price.utils";

export interface FresnoFairDetailFields {
  priceMin?: number;
  priceMax?: number;
  priceNotes?: string;
  ticketUrl?: string;
  currency?: string;
  descriptionText?: string;
  isFree?: boolean;
}

const BOX_OFFICE_PRICES_RE =
  /In-Person Box Office Prices?:[\s\S]*?<span[^>]*>([^<]+)<\/span>/i;
const ONLINE_PRICES_RE = /Online Prices[^:]*:[\s\S]*?<span[^>]*>([^<]+)<\/span>/i;
const ETIX_TICKET_URL_RE = /href="(https:\/\/www\.etix\.com\/[^"]+)"/i;
const TICKETS_START_AT_RE = /tickets?\s+start(?:ing)?\s+at\s+\$(\d+(?:\.\d{2})?)/i;

const MAX_DETAIL_DESCRIPTION_LENGTH = 6000;

const SKIP_DESCRIPTION_BLOCK_PATTERNS = [
  /\b20\d{2}\s+4\.0\s*&\s*above\s+winners\b/i,
  /\bhigh school winners\b/i,
  /\b8th grade winners\b/i,
  /\bprogram donors\b/i,
  /\bimportant eligibility\b/i,
  /\bprogram highlights\b/i,
  /\bfund a scholarship\b/i,
  /selection-marker/i
];

const MIN_PRIMARY_DESCRIPTION_LENGTH = 200;

export function parseDollarAmounts(text: string): number[] {
  const amounts: number[] = [];
  const re = /\$(\d+(?:\.\d{2})?)/g;
  let match: RegExpExecArray | null;
  while ((match = re.exec(text)) !== null) {
    const amount = Number(match[1]);
    if (Number.isFinite(amount)) {
      amounts.push(amount);
    }
  }
  return amounts;
}

function formatPriceTier(amount: number): string {
  return Number.isInteger(amount) ? `$${amount}` : `$${amount.toFixed(2)}`;
}

function priceRangeFromAmounts(amounts: number[]): Pick<FresnoFairDetailFields, "priceMin" | "priceMax" | "currency"> {
  if (amounts.length === 0) {
    return {};
  }
  return {
    priceMin: Math.min(...amounts),
    priceMax: Math.max(...amounts),
    currency: "USD"
  };
}

function buildPriceNotes(boxOfficePrices: number[], onlinePrices: number[]): string | undefined {
  const parts: string[] = [];
  if (boxOfficePrices.length > 0) {
    parts.push(`In-Person: ${boxOfficePrices.map(formatPriceTier).join("/")}`);
  }
  if (onlinePrices.length > 0) {
    parts.push(`Online: ${onlinePrices.map(formatPriceTier).join("/")}`);
  }
  return parts.length > 0 ? parts.join(" · ") : undefined;
}

function parseFresnoFairPricing(html: string): Pick<
  FresnoFairDetailFields,
  "priceMin" | "priceMax" | "priceNotes" | "ticketUrl" | "currency"
> {
  const boxOfficeMatch = html.match(BOX_OFFICE_PRICES_RE);
  const onlineMatch = html.match(ONLINE_PRICES_RE);
  const etixMatch = html.match(ETIX_TICKET_URL_RE);

  const boxOfficePrices = boxOfficeMatch?.[1] ? parseDollarAmounts(boxOfficeMatch[1]) : [];
  const onlinePrices = onlineMatch?.[1] ? parseDollarAmounts(onlineMatch[1]) : [];
  const primaryPrices = boxOfficePrices.length > 0 ? boxOfficePrices : onlinePrices;

  const priceNotes = buildPriceNotes(boxOfficePrices, onlinePrices);
  const ticketUrl = etixMatch?.[1]?.trim();

  return {
    ...priceRangeFromAmounts(primaryPrices),
    ...(priceNotes ? { priceNotes } : {}),
    ...(ticketUrl?.startsWith("http") ? { ticketUrl } : {})
  };
}

function isPricingBoilerplateBlock(text: string): boolean {
  return /box office prices/i.test(text) && /\$\d/.test(text);
}

function isTicketDisclaimerBlock(text: string): boolean {
  return (
    /fair admission is required/i.test(text) ||
    /validity of tickets sold through/i.test(text) ||
    /bff club pre-sale/i.test(text)
  );
}

function shouldSkipDescriptionBlock(text: string): boolean {
  if (isPricingBoilerplateBlock(text) || isTicketDisclaimerBlock(text)) {
    return true;
  }
  return SKIP_DESCRIPTION_BLOCK_PATTERNS.some((pattern) => pattern.test(text));
}

/** Strip CMS cruft: HTML tags, video transcript stubs, empty lines. */
export function cleanFresnoFairDescriptionText(text: string): string {
  const withoutHtml = text.replace(/<[^>]+>/g, "");

  const lines = withoutHtml
    .replace(/\r\n/g, "\n")
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .filter((line) => !/^of$/i.test(line))
    .filter((line) => !/^transcript$/i.test(line))
    .filter((line) => !/^of\s+transcript$/i.test(line));

  return lines.join("\n\n").replace(/\n{3,}/g, "\n\n").trim();
}

function textMediaBlockToPlainText($: ReturnType<typeof load>, el: AnyNode): string {
  const block = $(el).clone();
  block.find("script, style, noscript").remove();
  block.find("br").replaceWith("\n");
  for (const tag of ["p", "h2", "h3", "h4", "li"] as const) {
    block.find(tag).each((_, node) => {
      $(node).prepend("\n");
      $(node).append("\n");
    });
  }

  return block
    .text()
    .replace(/\r\n/g, "\n")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]{2,}/g, " ")
    .trim();
}

function blockHasParagraphCopy($: ReturnType<typeof load>, el: AnyNode): boolean {
  return $(el)
    .find("p")
    .toArray()
    .some((node) => $(node).text().replace(/\s+/g, " ").trim().length >= 40);
}

function pickPrimaryDescriptionBlock(
  $: ReturnType<typeof load>,
  candidates: Array<{ el: AnyNode; text: string }>
): string | undefined {
  const scored = candidates
    .map(({ el, text }) => {
      const cleaned = cleanFresnoFairDescriptionText(text);
      if (cleaned.length < MIN_PRIMARY_DESCRIPTION_LENGTH) {
        return null;
      }
      if (shouldSkipDescriptionBlock(cleaned)) {
        return null;
      }

      const score = cleaned.length + (blockHasParagraphCopy($, el) ? 500 : 0);
      return { cleaned, score };
    })
    .filter((item): item is { cleaned: string; score: number } => item !== null);

  if (scored.length === 0) {
    return undefined;
  }

  scored.sort((left, right) => right.score - left.score);
  return scored[0]?.cleaned;
}

/**
 * Extract one primary description block from a fair detail page.
 * Uses the richest TextMedia module with real paragraph copy — not a concat of every section.
 */
export function parseFresnoFairDescription(html: string): string | undefined {
  const $ = load(html);
  const candidates: Array<{ el: AnyNode; text: string }> = [];

  $(".entityContainerModule.TextMediaModule .modulePageTextMedia").each((_, el) => {
    const text = textMediaBlockToPlainText($, el as AnyNode);
    const cleaned = cleanFresnoFairDescriptionText(text);
    if (cleaned.length < 40) {
      return;
    }
    candidates.push({ el: el as AnyNode, text });
  });

  let primary = pickPrimaryDescriptionBlock($, candidates);
  if (!primary) {
    return undefined;
  }

  if (primary.length > MAX_DETAIL_DESCRIPTION_LENGTH) {
    primary = primary.slice(0, MAX_DETAIL_DESCRIPTION_LENGTH).replace(/\s+\S*$/, "").trim();
  }

  return primary.length > 0 ? primary : undefined;
}

export function pickFresnoFairDescription(
  listing: string | undefined,
  detail: string | undefined
): string | undefined {
  const listingText = listing?.trim();
  const detailText = detail?.trim();

  if (!detailText) {
    return listingText;
  }
  if (!listingText) {
    return detailText;
  }

  if (detailText.length >= 250 && detailText.length > listingText.length) {
    return detailText;
  }

  return listingText;
}

/** Parse Big Fresno Fair Saffire CMS event detail HTML for pricing, tickets, and program copy. */
export function parseFresnoFairDetailPage(html: string): FresnoFairDetailFields | null {
  const pricing = parseFresnoFairPricing(html);
  const descriptionText = parseFresnoFairDescription(html);
  const isFree = parseFresnoFairFreeAdmissionFromHtml(html);

  const hasPricing =
    typeof pricing.priceMin === "number" ||
    Boolean(pricing.priceNotes?.trim()) ||
    Boolean(pricing.ticketUrl?.trim());

  if (!hasPricing && !descriptionText && !isFree) {
    return null;
  }

  return {
    ...pricing,
    ...(descriptionText ? { descriptionText } : {}),
    ...(isFree ? { isFree: true, priceMin: 0, priceMax: 0 } : {})
  };
}

/** Fallback when detail HTML lacks structured tiers but listing copy mentions a starting price. */
export function parseTicketsStartAtPrice(
  text: string
): Pick<NormalizedEvent, "priceMin" | "currency"> | undefined {
  const match = text.match(TICKETS_START_AT_RE);
  if (!match?.[1]) {
    return undefined;
  }
  const priceMin = Number(match[1]);
  if (!Number.isFinite(priceMin)) {
    return undefined;
  }
  return { priceMin, currency: "USD" };
}

function eventHasPrice(event: NormalizedEvent): boolean {
  return (
    event.isFree === true ||
    typeof event.priceMin === "number" ||
    Boolean(event.priceNotes?.trim())
  );
}

export function mergeFresnoFairDetail(
  listing: NormalizedEvent,
  detail: FresnoFairDetailFields | null
): NormalizedEvent {
  if (!detail) {
    return applyFresnoFairPricePolicy(listing);
  }

  const descriptionText = pickFresnoFairDescription(listing.descriptionText, detail.descriptionText);

  if (detail.isFree === true) {
    return applyFresnoFairPricePolicy({
      ...listing,
      ...(descriptionText ? { descriptionText } : {})
    });
  }

  return applyFresnoFairPricePolicy({
    ...listing,
    ...(typeof detail.priceMin === "number" ? { priceMin: detail.priceMin } : {}),
    ...(typeof detail.priceMax === "number" ? { priceMax: detail.priceMax } : {}),
    ...(detail.currency ? { currency: detail.currency } : {}),
    ...(detail.priceNotes?.trim() ? { priceNotes: detail.priceNotes.trim() } : {}),
    ...(detail.ticketUrl?.trim() ? { ticketUrl: detail.ticketUrl.trim() } : {}),
    ...(descriptionText ? { descriptionText } : {})
  });
}

function applyDescriptionPriceFallback(event: NormalizedEvent): NormalizedEvent {
  if (eventHasPrice(event) || !event.descriptionText?.trim()) {
    return event;
  }
  const fallback = parseTicketsStartAtPrice(event.descriptionText);
  return fallback ? { ...event, ...fallback } : event;
}

export interface EnrichFresnoFairDetailsInput {
  events: NormalizedEvent[];
  userAgent: string;
  signal?: AbortSignal;
  sourceKey: string;
  dryRun?: boolean;
  venueLabel?: string;
}

export interface EnrichFresnoFairDetailsResult {
  events: NormalizedEvent[];
  errors: ScrapeError[];
  detailUrlsVisited: number;
  fetchUrls: string[];
}

/** Fetch unique fair detail pages and merge pricing + eTix links onto listing events. */
export async function enrichFresnoFairEventsWithDetails(
  input: EnrichFresnoFairDetailsInput
): Promise<EnrichFresnoFairDetailsResult> {
  const { events, userAgent, signal, sourceKey, dryRun, venueLabel } = input;

  if (dryRun) {
    return {
      events: events.map((event) => applyFresnoFairPricePolicy(applyDescriptionPriceFallback(event))),
      errors: [],
      detailUrlsVisited: 0,
      fetchUrls: []
    };
  }

  const bySourceEventId = new Map(events.map((event) => [event.sourceEventId, event]));
  const seenUrls = new Set<string>();
  const errors: ScrapeError[] = [];
  const fetchUrls: string[] = [];
  let detailUrlsVisited = 0;

  console.log(
    JSON.stringify({
      event: "fresno_fair_api",
      step: "detail_enrich_start",
      event_count: events.length,
      ...(venueLabel ? { venue_label: venueLabel } : {})
    })
  );
  if (venueLabel) {
    const uniqueUrls = new Set(
      events
        .map((event) => event.externalUrl?.replace(/\/+$/, ""))
        .filter((url): url is string => Boolean(url?.startsWith("http")))
    );
    console.log(`[ingest] ${venueLabel}: fetching ${uniqueUrls.size} detail page(s) for pricing and descriptions…`);
  }

  for (const event of events) {
    const url = event.externalUrl?.trim();
    if (!url?.startsWith("http")) {
      continue;
    }

    const normalizedUrl = url.replace(/\/+$/, "");
    if (seenUrls.has(normalizedUrl)) {
      continue;
    }
    seenUrls.add(normalizedUrl);

    detailUrlsVisited += 1;
    fetchUrls.push(url);

    if (signal?.aborted) {
      throw new DOMException("Ingest aborted", "AbortError");
    }

    try {
      const html = await fetchListingHtml(url, userAgent, signal);
      const detail = parseFresnoFairDetailPage(html);

      for (const [sourceEventId, listing] of bySourceEventId) {
        const listingUrl = listing.externalUrl?.replace(/\/+$/, "");
        if (listingUrl === normalizedUrl) {
          bySourceEventId.set(sourceEventId, mergeFresnoFairDetail(listing, detail));
        }
      }
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") {
        throw error;
      }
      errors.push({
        source: sourceKey,
        url,
        message: error instanceof Error ? error.message : "fresno fair detail fetch failed",
        recoverable: true
      });
    }

    await sleep(DETAIL_DELAY_MS);
  }

  const enriched = [...bySourceEventId.values()].map((event) =>
    applyFresnoFairPricePolicy(applyDescriptionPriceFallback(event))
  );

  console.log(
    JSON.stringify({
      event: "fresno_fair_api",
      step: "detail_enrich_end",
      detail_urls_visited: detailUrlsVisited,
      priced_events: enriched.filter(eventHasPrice).length,
      described_events: enriched.filter((event) => (event.descriptionText?.trim().length ?? 0) >= 250).length,
      errors: errors.length
    })
  );

  return {
    events: enriched,
    errors,
    detailUrlsVisited,
    fetchUrls
  };
}
