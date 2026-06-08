import { load } from "cheerio";

import { resolveVenueLocationFields, type NormalizedEvent } from "@fresno-events/shared";

export interface VisitFresnoDetailFields {
  descriptionText?: string;
  venueAddress?: string;
  venueName?: string;
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

export function parseVisitFresnoPriceText(raw: string): Pick<
  NormalizedEvent,
  "isFree" | "priceMin" | "priceMax" | "priceNotes" | "currency"
> {
  const text = raw.trim();
  if (!text) {
    return {};
  }

  if (/^free$/i.test(text)) {
    return { isFree: true, currency: "USD" };
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

  const descriptionBlock = $("h2")
    .filter((_, el) => $(el).text().trim().toLowerCase() === "description")
    .first()
    .next();
  const descriptionFromSection = descriptionBlock.text().replace(/\s+/g, " ").trim();
  const descriptionText =
    descriptionFromSection ||
    $('meta[property="og:description"]').attr("content")?.trim() ||
    $('meta[name="description"]').attr("content")?.trim();

  const venueAddress = readInfoListValue($, "address");
  const venueName = readInfoListValue($, "location");
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

  return {
    ...listing,
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
