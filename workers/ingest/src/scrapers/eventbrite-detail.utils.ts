import type { NormalizedEvent } from "@fresno-events/shared";
import { roundDisplayPriceUp } from "@fresno-events/shared";

import { formatVisitFresnoDescriptionHtml } from "@/scrapers/visit-fresno-detail.utils";

export const MAX_EVENTBRITE_DESCRIPTION_LENGTH = 6000;

const EVENTBRITE_EVENT_PATH = /\/e\/(?:[^/?#]*-)?(\d+)/i;

/** Eventbrite hosts that are not single-event ticket pages. */
const NON_EVENT_EVENTBRITE_HOSTS = new Set([
  "eventbrite.com",
  "www.eventbrite.com",
  "help.eventbrite.com",
  "blog.eventbrite.com",
  "developer.eventbrite.com"
]);

function isEventbriteHostname(hostname: string): boolean {
  const host = hostname.toLowerCase();
  return host === "eventbrite.com" || host.endsWith(".eventbrite.com");
}

export interface EventbriteDetailFields {
  descriptionText?: string;
  imageUrl?: string;
  isFree?: boolean;
  priceMin?: number;
  priceMax?: number;
}

export function isEventbriteEventUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    const host = parsed.hostname.toLowerCase();
    if (!isEventbriteHostname(host)) {
      return false;
    }
    if (EVENTBRITE_EVENT_PATH.test(parsed.pathname)) {
      return true;
    }
    // Branded subdomain ticket pages, e.g. https://my-event.eventbrite.com/
    return host.endsWith(".eventbrite.com") && !NON_EVENT_EVENTBRITE_HOSTS.has(host);
  } catch {
    return false;
  }
}

export function extractEventbriteEventId(url: string): string | null {
  const match = EVENTBRITE_EVENT_PATH.exec(url);
  return match?.[1] ?? null;
}

/** Canonical ticket URL — numeric event id path, no tracking query. */
export function normalizeEventbriteEventUrl(url: string): string | null {
  const id = extractEventbriteEventId(url);
  if (!id) {
    return null;
  }
  return `https://www.eventbrite.com/e/event-${id}`;
}

export function resolveEventbriteUrlFromEvent(event: NormalizedEvent): string | null {
  for (const raw of [event.ticketUrl, event.externalUrl]) {
    const trimmed = raw?.trim();
    if (trimmed && isEventbriteEventUrl(trimmed)) {
      return trimmed;
    }
  }
  return null;
}

function deepFindStructuredContent(root: unknown): { modules?: Array<{ type?: string; text?: string }> } | null {
  if (!root || typeof root !== "object") {
    return null;
  }

  if ("structuredContent" in root) {
    const value = (root as { structuredContent?: unknown }).structuredContent;
    if (value && typeof value === "object") {
      return value as { modules?: Array<{ type?: string; text?: string }> };
    }
  }

  if (Array.isArray(root)) {
    for (const item of root) {
      const found = deepFindStructuredContent(item);
      if (found) {
        return found;
      }
    }
    return null;
  }

  for (const value of Object.values(root)) {
    const found = deepFindStructuredContent(value);
    if (found) {
      return found;
    }
  }

  return null;
}

function extractNextDataJson(html: string): unknown | null {
  const match = /<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/i.exec(html);
  if (!match?.[1]) {
    return null;
  }
  try {
    return JSON.parse(match[1]) as unknown;
  } catch {
    return null;
  }
}

function deepFindPageContext(root: unknown): Record<string, unknown> | null {
  if (!root || typeof root !== "object") {
    return null;
  }
  if ("context" in root && root.context && typeof root.context === "object") {
    return root.context as Record<string, unknown>;
  }
  if (Array.isArray(root)) {
    for (const item of root) {
      const found = deepFindPageContext(item);
      if (found) {
        return found;
      }
    }
    return null;
  }
  for (const value of Object.values(root)) {
    const found = deepFindPageContext(value);
    if (found) {
      return found;
    }
  }
  return null;
}

function parseEventbriteGalleryImage(context: Record<string, unknown>): string | undefined {
  const gallery = context.gallery;
  if (!gallery || typeof gallery !== "object") {
    return undefined;
  }
  const images = (gallery as { images?: Array<{ url?: string }> }).images;
  const url = images?.[0]?.url?.trim();
  return url?.startsWith("http") ? url : undefined;
}

function parseEventbriteIsFree(context: Record<string, unknown>): boolean | undefined {
  const basicInfo = context.basicInfo;
  if (!basicInfo || typeof basicInfo !== "object") {
    return undefined;
  }
  return (basicInfo as { isFree?: boolean }).isFree === true ? true : undefined;
}

function parseEventbritePriceValue(raw: string | number | undefined): number | undefined {
  if (typeof raw === "number" && Number.isFinite(raw) && raw >= 0) {
    return raw;
  }
  if (typeof raw === "string") {
    const parsed = Number(raw);
    if (Number.isFinite(parsed) && parsed >= 0) {
      return parsed;
    }
  }
  return undefined;
}

/** Round up to whole dollars — display estimate only; ticket URL is authoritative. */
export function roundEventbriteDisplayPrice(price: number): number {
  return roundDisplayPriceUp(price);
}

/** Eventbrite embeds ticket range in SEO AggregateOffer schema (SSR, not client-only). */
export function parseEventbriteOffersPrices(
  context: Record<string, unknown>
): Pick<EventbriteDetailFields, "priceMin" | "priceMax"> {
  const seo = context.seo;
  if (!seo || typeof seo !== "object") {
    return {};
  }

  const offersSchema = (seo as { offersSchema?: unknown }).offersSchema;
  if (!Array.isArray(offersSchema) || offersSchema.length === 0) {
    return {};
  }

  const prices: number[] = [];
  for (const offer of offersSchema) {
    if (!offer || typeof offer !== "object") {
      continue;
    }
    const record = offer as { lowPrice?: string | number; highPrice?: string | number };
    const low = parseEventbritePriceValue(record.lowPrice);
    const high = parseEventbritePriceValue(record.highPrice);
    if (low !== undefined) {
      prices.push(low);
    }
    if (high !== undefined) {
      prices.push(high);
    }
  }

  if (prices.length === 0) {
    return {};
  }

  return {
    priceMin: roundEventbriteDisplayPrice(Math.min(...prices)),
    priceMax: roundEventbriteDisplayPrice(Math.max(...prices))
  };
}

export function formatEventbriteDescriptionHtml(html: string): string {
  return formatVisitFresnoDescriptionHtml(html);
}

export function parseEventbriteDetailHtml(html: string): EventbriteDetailFields | null {
  const nextData = extractNextDataJson(html);
  if (!nextData) {
    return null;
  }

  const context = deepFindPageContext(nextData);
  const structured = deepFindStructuredContent(nextData);
  const textModules = structured?.modules?.filter((module) => module.type === "text" && module.text?.trim()) ?? [];

  const blocks = textModules
    .map((module) => formatEventbriteDescriptionHtml(module.text!.trim()))
    .filter(Boolean);

  const descriptionText = blocks.join("\n\n").trim().slice(0, MAX_EVENTBRITE_DESCRIPTION_LENGTH);
  const imageUrl = context ? parseEventbriteGalleryImage(context) : undefined;
  let isFree = context ? parseEventbriteIsFree(context) : undefined;
  const { priceMin, priceMax } = context ? parseEventbriteOffersPrices(context) : {};
  if (isFree !== true && priceMin === 0 && priceMax === 0) {
    isFree = true;
  }

  if (!descriptionText && !imageUrl && !isFree && priceMin === undefined) {
    return null;
  }

  return {
    ...(descriptionText ? { descriptionText } : {}),
    ...(imageUrl ? { imageUrl } : {}),
    ...(isFree ? { isFree } : {}),
    ...(priceMin !== undefined ? { priceMin, ...(priceMax !== undefined ? { priceMax } : {}) } : {})
  };
}

export function looksLikeEventbriteBlockPage(html: string): boolean {
  const lower = html.toLowerCase();
  return (
    lower.includes("captcha") ||
    lower.includes("access denied") ||
    lower.includes("unusual traffic") ||
    /<h1[^>]*>\s*403\s/i.test(html)
  );
}

export function shouldReplaceEventbriteDescription(
  current: string | undefined,
  incoming: string
): boolean {
  const currentLen = current?.trim().length ?? 0;
  const incomingLen = incoming.trim().length;
  if (incomingLen === 0) {
    return false;
  }
  if (currentLen === 0) {
    return true;
  }
  return incomingLen > currentLen * 1.2;
}

/**
 * Merge Eventbrite detail into a listing from any source.
 * Description: keep the original when present; use Eventbrite only when the listing
 * has none or Eventbrite text is materially longer (>20%). Image / price / isFree fill gaps.
 */
export function mergeEventbriteDetail(
  listing: NormalizedEvent,
  detail: EventbriteDetailFields
): NormalizedEvent {
  const incomingDescription = detail.descriptionText?.trim() ?? "";
  const shouldReplaceDescription =
    incomingDescription.length > 0 &&
    shouldReplaceEventbriteDescription(listing.descriptionText, incomingDescription);

  const shouldAddImage = !listing.imageUrl?.trim() && Boolean(detail.imageUrl?.trim());
  const shouldFillPrice =
    typeof listing.priceMin !== "number" &&
    typeof detail.priceMin === "number" &&
    !(detail.priceMin === 0 && detail.priceMax === 0);
  const eventbriteIsFree =
    detail.isFree === true || (detail.priceMin === 0 && detail.priceMax === 0);
  const shouldMarkFree =
    eventbriteIsFree &&
    listing.isFree !== true &&
    typeof listing.priceMin !== "number" &&
    !listing.priceNotes?.trim();

  if (!shouldReplaceDescription && !shouldAddImage && !shouldFillPrice && !shouldMarkFree) {
    return listing;
  }

  return {
    ...listing,
    ...(shouldReplaceDescription ? { descriptionText: incomingDescription } : {}),
    ...(shouldAddImage ? { imageUrl: detail.imageUrl!.trim() } : {}),
    ...(shouldFillPrice
      ? {
          priceMin: detail.priceMin,
          ...(typeof detail.priceMax === "number" ? { priceMax: detail.priceMax } : {})
        }
      : {}),
    ...(shouldMarkFree ? { isFree: true, priceMin: 0, priceMax: 0 } : {})
  };
}

export function preserveEventbriteEnrichedDescription(
  incoming: NormalizedEvent,
  existing: NormalizedEvent,
  eventbriteDetailStatus: string | null | undefined
): NormalizedEvent {
  if (eventbriteDetailStatus !== "fetched") {
    return incoming;
  }

  let result = incoming;

  const existingDesc = existing.descriptionText?.trim() ?? "";
  const incomingDesc = result.descriptionText?.trim() ?? "";
  if (shouldReplaceEventbriteDescription(incomingDesc, existingDesc)) {
    result = { ...result, descriptionText: existing.descriptionText };
  }

  const existingImage = existing.imageUrl?.trim();
  if (existingImage && !result.imageUrl?.trim()) {
    result = { ...result, imageUrl: existingImage };
  }

  if (typeof existing.priceMin === "number" && typeof result.priceMin !== "number") {
    result = {
      ...result,
      priceMin: existing.priceMin,
      ...(typeof existing.priceMax === "number" ? { priceMax: existing.priceMax } : {})
    };
  }

  if (
    existing.isFree === true &&
    result.isFree !== true &&
    typeof result.priceMin !== "number" &&
    !result.priceNotes?.trim()
  ) {
    result = { ...result, isFree: true, priceMin: 0, priceMax: 0 };
  }

  return result;
}
