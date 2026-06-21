import type { NormalizedEvent } from "@fresno-events/shared";
import { roundDisplayPriceUp } from "@fresno-events/shared";

export interface TicketSauceDetailFields {
  priceMin?: number;
  priceMax?: number;
  ticketUrl?: string;
  /** Buyer-facing all-in prices (base + fees), not JSON-LD face value. */
  priceIncludesFees?: boolean;
}

const NON_ADMISSION_OFFER_LABEL =
  /\b(parking|permit|fee|addon|add-on|merch|donation|valet|insurance|refund protection)\b/i;

/** Round up to whole dollars — display estimate; ticket URL is authoritative. */
export function roundTicketSauceDisplayPrice(price: number): number {
  return roundDisplayPriceUp(price);
}

export function isTicketSauceUrl(url: string): boolean {
  try {
    const host = new URL(url).hostname.toLowerCase();
    return host.endsWith(".ticketsauce.com");
  } catch {
    return false;
  }
}

/** Event detail or tickets page → canonical `/e/{slug}/tickets` URL. */
export function resolveTicketSauceTicketsUrl(url: string): string | null {
  try {
    const parsed = new URL(url);
    if (!isTicketSauceUrl(parsed.href)) {
      return null;
    }

    const path = parsed.pathname.replace(/\/+$/, "");
    if (/^\/e\/[^/]+\/tickets$/i.test(path)) {
      parsed.search = "";
      parsed.hash = "";
      return parsed.href;
    }
    if (/^\/e\/[^/]+$/i.test(path)) {
      parsed.pathname = `${path}/tickets`;
      parsed.search = "";
      parsed.hash = "";
      return parsed.href;
    }
    return null;
  } catch {
    return null;
  }
}

export function resolveTicketSauceUrlFromEvent(event: NormalizedEvent): string | null {
  for (const raw of [event.ticketUrl, event.externalUrl]) {
    const trimmed = raw?.trim();
    if (trimmed && isTicketSauceUrl(trimmed)) {
      return trimmed;
    }
  }
  return null;
}

function isNonAdmissionTicketTypeName(name: string): boolean {
  return NON_ADMISSION_OFFER_LABEL.test(name);
}

/** Seat-map all-in prices embedded in TicketSauce checkout JS. */
export function parseTicketSaucePricingArray(html: string): number[] {
  const match = /pricing:\s*\[\s*([^\]]+)\]/i.exec(html);
  if (!match?.[1]) {
    return [];
  }

  const prices: number[] = [];
  const priceRe = /['"]price['"]\s*:\s*([0-9]+(?:\.[0-9]+)?)/gi;
  let entry: RegExpExecArray | null;
  while ((entry = priceRe.exec(match[1])) !== null) {
    const price = Number.parseFloat(entry[1] ?? "");
    if (Number.isFinite(price) && price > 0) {
      prices.push(price);
    }
  }
  return prices;
}

/** All-in prices on ticket rows (`data-default-all-in-price-each`), excluding parking/add-ons. */
export function parseTicketSauceAllInInputPrices(html: string): number[] {
  const prices: number[] = [];
  const rowRe =
    /ticket_type_name[^>]*value="([^"]+)"[\s\S]{0,1200}?data-default-all-in-price-each="([0-9.]+)"/gi;
  let entry: RegExpExecArray | null;
  while ((entry = rowRe.exec(html)) !== null) {
    const name = entry[1] ?? "";
    if (isNonAdmissionTicketTypeName(name)) {
      continue;
    }
    const price = Number.parseFloat(entry[2] ?? "");
    if (Number.isFinite(price) && price > 0) {
      prices.push(price);
    }
  }
  return prices;
}

/**
 * Parse buyer-facing prices from a TicketSauce `/tickets` page.
 * Prefers seat-map `pricing` array; falls back to per-row all-in hidden fields.
 * Returns null when only face-value JSON-LD is available (no upgrade path).
 */
export function parseTicketSauceTicketsPage(html: string, ticketsUrl: string): TicketSauceDetailFields | null {
  const seatMapPrices = parseTicketSaucePricingArray(html);
  const admissionPrices =
    seatMapPrices.length > 0 ? seatMapPrices : parseTicketSauceAllInInputPrices(html);

  if (admissionPrices.length === 0) {
    return null;
  }

  return {
    priceMin: roundTicketSauceDisplayPrice(Math.min(...admissionPrices)),
    priceMax: roundTicketSauceDisplayPrice(Math.max(...admissionPrices)),
    ticketUrl: ticketsUrl,
    priceIncludesFees: true
  };
}

function shouldApplyTicketSaucePrices(
  listing: NormalizedEvent,
  detail: TicketSauceDetailFields
): boolean {
  if (typeof detail.priceMin !== "number") {
    return false;
  }
  if (detail.priceIncludesFees) {
    if (typeof listing.priceMin !== "number") {
      return true;
    }
    // All-in should be >= face value; allow small drift for rounding.
    return detail.priceMin >= listing.priceMin - 0.01;
  }
  return typeof listing.priceMin !== "number";
}

/**
 * Merge TicketSauce ticket-page detail into any source listing.
 * Replaces face-value JSON-LD prices with all-in buyer prices when available.
 */
export function mergeTicketSauceDetail(
  listing: NormalizedEvent,
  detail: TicketSauceDetailFields
): NormalizedEvent {
  const shouldApplyPrice = shouldApplyTicketSaucePrices(listing, detail);
  const ticketsUrl = detail.ticketUrl?.trim();
  const shouldSetTicketUrl = Boolean(ticketsUrl) && !listing.ticketUrl?.trim();

  if (!shouldApplyPrice && !shouldSetTicketUrl) {
    return listing;
  }

  return {
    ...listing,
    ...(shouldSetTicketUrl && ticketsUrl ? { ticketUrl: ticketsUrl } : {}),
    ...(shouldApplyPrice
      ? {
          priceMin: detail.priceMin,
          ...(typeof detail.priceMax === "number" ? { priceMax: detail.priceMax } : {})
        }
      : {})
  };
}
