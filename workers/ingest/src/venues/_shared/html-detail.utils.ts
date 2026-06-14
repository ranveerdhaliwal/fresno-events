import { resolveVenueLocationFields } from "@fresno-events/shared";
import { load } from "cheerio";

import type { AiDiscoveryItem } from "@/ai";

type CheerioRoot = ReturnType<typeof load>;

function readPostalAddress(location: unknown): Pick<AiDiscoveryItem, "venueAddress" | "venueCity"> {
  if (!location || typeof location !== "object") {
    return {};
  }
  const loc = location as Record<string, unknown>;
  const address = loc.address;
  if (!address || typeof address !== "object") {
    return {};
  }
  const addr = address as Record<string, unknown>;
  const street = typeof addr.streetAddress === "string" ? addr.streetAddress.trim() : "";
  const city = typeof addr.addressLocality === "string" ? addr.addressLocality.trim() : "";
  const state = typeof addr.addressRegion === "string" ? addr.addressRegion.trim() : "";
  if (!street) {
    return {};
  }
  const resolved = resolveVenueLocationFields(street, city || null, state || null);
  return {
    ...(resolved.venueAddress ? { venueAddress: resolved.venueAddress } : {}),
    ...(resolved.venueCity ? { venueCity: resolved.venueCity } : {})
  };
}

function readJsonLdImage(value: unknown): string | undefined {
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed.startsWith("http") ? trimmed : undefined;
  }
  if (Array.isArray(value)) {
    for (const item of value) {
      const url = readJsonLdImage(item);
      if (url) {
        return url;
      }
    }
    return undefined;
  }
  if (!value || typeof value !== "object") {
    return undefined;
  }
  const record = value as Record<string, unknown>;
  return readJsonLdImage(record.url ?? record.contentUrl ?? record["@id"]);
}

function isNonAdmissionOffer(record: Record<string, unknown>): boolean {
  const label = `${String(record.name ?? "")} ${String(record.category ?? "")}`.toLowerCase();
  return /\b(parking|permit|fee|addon|add-on|merch|donation|valet)\b/.test(label);
}

function readJsonLdOffers(
  offers: unknown
): Pick<AiDiscoveryItem, "ticketUrl" | "priceMin" | "priceMax"> {
  const list = Array.isArray(offers) ? offers : offers ? [offers] : [];
  const prices: number[] = [];
  let ticketUrl: string | undefined;

  for (const offer of list) {
    if (!offer || typeof offer !== "object") {
      continue;
    }
    const record = offer as Record<string, unknown>;
    if (!ticketUrl && typeof record.url === "string" && record.url.trim().startsWith("http")) {
      ticketUrl = record.url.trim();
    }
    if (isNonAdmissionOffer(record)) {
      continue;
    }
    const rawPrice = record.price;
    const price =
      typeof rawPrice === "number"
        ? rawPrice
        : typeof rawPrice === "string"
          ? Number.parseFloat(rawPrice)
          : Number.NaN;
    if (Number.isFinite(price)) {
      prices.push(price);
    }
  }

  return {
    ...(ticketUrl ? { ticketUrl } : {}),
    ...(prices.length > 0 ? { priceMin: Math.min(...prices), priceMax: Math.max(...prices) } : {})
  };
}

function readJsonLdEvent($: CheerioRoot): AiDiscoveryItem | null {
  const scripts = $('script[type="application/ld+json"]');
  for (const el of scripts.toArray()) {
    const raw = $(el).html()?.trim();
    if (!raw) continue;
    try {
      const parsed = JSON.parse(raw) as unknown;
      const nodes = Array.isArray(parsed) ? parsed : [parsed];
      for (const node of nodes) {
        if (!node || typeof node !== "object") continue;
        const record = node as Record<string, unknown>;
        const type = String(record["@type"] ?? "");
        if (!type.toLowerCase().includes("event")) continue;
        const title = typeof record.name === "string" ? record.name.trim() : "";
        const startTs =
          typeof record.startDate === "string"
            ? record.startDate
            : typeof record.startDate === "object" && record.startDate
              ? String((record.startDate as { "@value"?: string })["@value"] ?? "")
              : "";
        const descriptionText =
          typeof record.description === "string" ? record.description.trim() : undefined;
        const location = record.location;
        let venueName = "";
        if (location && typeof location === "object") {
          const loc = location as Record<string, unknown>;
          venueName = typeof loc.name === "string" ? loc.name.trim() : "";
        }
        if (!title || !startTs) continue;

        const addressFields = readPostalAddress(location);
        const imageUrl = readJsonLdImage(record.image);
        const offerFields = readJsonLdOffers(record.offers);
        const externalUrl =
          typeof record.url === "string" && record.url.trim().startsWith("http")
            ? record.url.trim()
            : undefined;

        return {
          title,
          venueName: venueName || "Fresno",
          startTs,
          ...(descriptionText ? { descriptionText } : {}),
          ...addressFields,
          ...(imageUrl ? { imageUrl } : {}),
          ...offerFields,
          ...(externalUrl ? { externalUrl } : {})
        };
      }
    } catch {
      /* try next script */
    }
  }
  return null;
}

function isEventImageUrl(url: string): boolean {
  const lower = url.toLowerCase();
  return (
    !lower.includes("partner-logos") &&
    !lower.includes("help-questionmark") &&
    !lower.includes("favicon.ico")
  );
}

function readEventImageFromHtml($: CheerioRoot): string | undefined {
  const ogImage = $('meta[property="og:image"]').attr("content")?.trim();
  if (ogImage?.startsWith("http") && isEventImageUrl(ogImage)) {
    return ogImage;
  }

  for (const el of $("img.img-responsive").toArray()) {
    const src = $(el).attr("src")?.trim();
    if (src?.startsWith("http") && isEventImageUrl(src)) {
      return src;
    }
  }

  const galleryHref = $('.photo a[data-fancybox="gallery"]').first().attr("href")?.trim();
  if (galleryHref?.startsWith("http") && isEventImageUrl(galleryHref)) {
    return galleryHref;
  }

  const bgStyle = $(".photo").first().attr("style") ?? "";
  const bgMatch = /background-image:\s*url\(['"]?([^'")]+)/i.exec(bgStyle);
  const bgUrl = bgMatch?.[1]?.trim();
  if (bgUrl?.startsWith("http") && isEventImageUrl(bgUrl)) {
    return bgUrl;
  }

  return undefined;
}

function readVenueFieldsFromHtml($: CheerioRoot): Pick<AiDiscoveryItem, "venueName" | "venueAddress" | "venueCity"> {
  let venueName: string | undefined;
  let venueAddress: string | undefined;
  let venueCity: string | undefined;

  for (const el of $(".location").toArray()) {
    const row = $(el);
    const text = row.find(".datetime-location-content").text().replace(/\s+/g, " ").trim();
    if (!text) {
      continue;
    }
    const hasLocationIcon = row.find("i.fa-location-dot, i.fa-solid.fa-location-dot").length > 0;
    const hasMapIcon = row.find("i.fa-map, i.fa-solid.fa-map").length > 0;

    if (hasLocationIcon && !venueName) {
      venueName = text;
      continue;
    }
    if (hasMapIcon && !venueAddress) {
      const resolved = resolveVenueLocationFields(text, null, "CA");
      venueAddress = resolved.venueAddress ?? text;
      venueCity = resolved.venueCity ?? undefined;
    }
  }

  return {
    ...(venueName ? { venueName } : {}),
    ...(venueAddress ? { venueAddress } : {}),
    ...(venueCity ? { venueCity } : {})
  };
}

function readMetaFallbackDetail(
  $: CheerioRoot,
  pageUrl: string,
  fallbackVenue: string
): AiDiscoveryItem | null {
  const title =
    $('meta[property="og:title"]').attr("content")?.trim() ||
    $("h1").first().text().trim() ||
    $("title").text().trim();
  const descriptionText =
    $('meta[property="og:description"]').attr("content")?.trim() ||
    $('meta[name="description"]').attr("content")?.trim() ||
    $("article").first().text().trim().slice(0, 4000) ||
    undefined;

  const timeMeta =
    $('meta[property="event:start_time"]').attr("content")?.trim() ||
    $('time[datetime]').first().attr("datetime")?.trim();

  if (!title) {
    return null;
  }

  const startTs = timeMeta ? new Date(timeMeta).toISOString() : new Date().toISOString();
  if (Number.isNaN(new Date(startTs).getTime())) {
    return null;
  }

  return {
    title,
    venueName: fallbackVenue,
    startTs,
    externalUrl: pageUrl,
    ...(descriptionText ? { descriptionText } : {})
  };
}

function supplementDiscoveryFromHtml(
  $: CheerioRoot,
  base: AiDiscoveryItem,
  pageUrl: string,
  fallbackVenue: string
): AiDiscoveryItem {
  const htmlVenue = readVenueFieldsFromHtml($);
  const imageUrl = base.imageUrl?.trim() || readEventImageFromHtml($);

  const venueName =
    base.venueName && base.venueName !== fallbackVenue
      ? base.venueName
      : htmlVenue.venueName?.trim() || base.venueName || fallbackVenue;

  return {
    ...base,
    venueName,
    externalUrl: base.externalUrl?.trim() || pageUrl,
    ...(base.venueAddress?.trim() ? { venueAddress: base.venueAddress.trim() } : {}),
    ...(!base.venueAddress?.trim() && htmlVenue.venueAddress
      ? { venueAddress: htmlVenue.venueAddress }
      : {}),
    ...(base.venueCity?.trim() ? { venueCity: base.venueCity.trim() } : {}),
    ...(!base.venueCity?.trim() && htmlVenue.venueCity ? { venueCity: htmlVenue.venueCity } : {}),
    ...(imageUrl ? { imageUrl } : {})
  };
}

/** Best-effort SSR detail parse (no LLM). */
export function parsePlainHtmlDetailPage(
  html: string,
  pageUrl: string,
  fallbackVenue: string
): AiDiscoveryItem | null {
  const $ = load(html);
  const fromLd = readJsonLdEvent($);
  const base =
    fromLd?.title && fromLd.startTs ? fromLd : readMetaFallbackDetail($, pageUrl, fallbackVenue);
  if (!base?.title) {
    return null;
  }

  return supplementDiscoveryFromHtml($, base, pageUrl, fallbackVenue);
}
