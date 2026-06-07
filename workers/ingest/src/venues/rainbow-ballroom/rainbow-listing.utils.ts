import type { NormalizedEvent } from "@fresno-events/shared";
import type { Cheerio } from "cheerio";
import { load } from "cheerio";

import { getPacificDateTimeParts, instantFromPacificLocal } from "@/lib/pacific-instant.utils";
import type { VenueConfig } from "@/venues/venue.types";

const MONTH_ABBR: Record<string, string> = {
  jan: "01",
  feb: "02",
  mar: "03",
  apr: "04",
  may: "05",
  jun: "06",
  jul: "07",
  aug: "08",
  sep: "09",
  oct: "10",
  nov: "11",
  dec: "12"
};

const TICKET_HOSTS = ["eventmania.com", "tixr.com", "eventbrite.com", "ticketon.com"] as const;

function isTicketUrl(url: string): boolean {
  try {
    const host = new URL(url).hostname.replace(/^www\./, "");
    return TICKET_HOSTS.some((allowed) => host === allowed || host.endsWith(`.${allowed}`));
  } catch {
    return false;
  }
}

function yearFromUrl(url: string): string | null {
  const match = url.match(/(\d{4})-\d{2}-\d{2}/);
  return match?.[1] ?? null;
}

function inferYearFromRef(month: string, day: string, ref: Date): string {
  const refYmd = getPacificDateTimeParts(ref).date;
  const refYear = refYmd.slice(0, 4);
  const candidate = `${refYear}-${month}-${day}`;
  const noon = instantFromPacificLocal(candidate, "12:00");
  const candTs = noon ? Date.parse(noon) : Number.NaN;
  if (!Number.isNaN(candTs) && candTs < ref.getTime() - 7 * 86_400_000) {
    return String(Number(refYear) + 1);
  }
  return refYear;
}

function parseCardDateYmd($card: Cheerio<unknown>, urlYearHint: string | null, ref: Date): string | null {
  const monthText = $card.find(".data-categories .datatexdday").eq(1).text().trim().toLowerCase().slice(0, 3);
  const dayNum = Number.parseInt($card.find(".data-categories .text-block-4").text().trim(), 10);
  const month = MONTH_ABBR[monthText];
  if (!month || !Number.isFinite(dayNum) || dayNum < 1 || dayNum > 31) {
    return null;
  }
  const day = String(dayNum).padStart(2, "0");
  const year = urlYearHint ?? inferYearFromRef(month, day, ref);
  return `${year}-${month}-${day}`;
}

function slugFromTicketUrl(url: string): string {
  try {
    const parsed = new URL(url);
    if (parsed.hostname.includes("eventbrite")) {
      const eventId = parsed.pathname.match(/\/e\/(\d+)/)?.[1];
      if (eventId) {
        return eventId;
      }
    }
    const parts = parsed.pathname.split("/").filter(Boolean);
    const slug = parts[parts.length - 1] ?? "event";
    return slug.replace(/[^a-z0-9-]+/gi, "-").slice(0, 80);
  } catch {
    return "event";
  }
}

function imageUrlFromCard($card: Cheerio<unknown>): string | undefined {
  const $img = $card.find("a.image-item img.image-grid, a.image-item img").first();
  const src = $img.attr("src")?.trim();
  if (src?.startsWith("http")) {
    return src;
  }
  const srcset = $img.attr("srcset")?.trim();
  if (!srcset) {
    return undefined;
  }
  const candidates = srcset
    .split(",")
    .map((part) => part.trim().split(/\s+/)[0])
    .filter((url): url is string => Boolean(url?.startsWith("http")));
  return candidates[candidates.length - 1];
}

function ticketUrlFromCard($card: Cheerio<unknown>): string | null {
  const candidates = [
    $card.find("a.image-item").attr("href"),
    $card.find("a.heading-blog-post").attr("href")
  ];
  for (const href of candidates) {
    const trimmed = href?.trim();
    if (trimmed?.startsWith("http") && isTicketUrl(trimmed)) {
      return trimmed.replace(/\/+$/, "");
    }
  }
  return null;
}

/** SSR grid at https://www.rainbowballroom.com/blog-grid (eventmania, tixr, eventbrite, ticketon). */
export function parseRainbowListingHtml(
  html: string,
  config: VenueConfig,
  ref: Date = new Date()
): NormalizedEvent[] {
  const $ = load(html);
  const host = (config.sourceHostname ?? "www.rainbowballroom.com").replace(/^www\./, "");
  const seen = new Set<string>();
  const events: NormalizedEvent[] = [];

  $("div.collection-item.w-dyn-item, div[role='listitem'].collection-item").each((_, el) => {
    const $card = $(el);
    const ticketUrl = ticketUrlFromCard($card);
    if (!ticketUrl || seen.has(ticketUrl)) {
      return;
    }

    const title = $card.find("h4.heading-blog-post").text().trim();
    if (!title) {
      return;
    }

    const urlYear = yearFromUrl(ticketUrl);
    const dateYmd = parseCardDateYmd($card, urlYear, ref) ?? (ticketUrl.match(/(\d{4}-\d{2}-\d{2})/)?.[1] ?? null);
    const startTs = dateYmd ? instantFromPacificLocal(dateYmd, "20:00") : null;
    if (!startTs) {
      return;
    }

    const imageUrl = imageUrlFromCard($card);

    seen.add(ticketUrl);
    events.push({
      source: `scrape:${host}`,
      sourceEventId: `venue:${config.key}:${slugFromTicketUrl(ticketUrl)}`,
      title,
      venueName: config.label,
      venueCity: "Fresno",
      startTs,
      category: "music",
      externalUrl: ticketUrl,
      ticketUrl,
      ...(imageUrl ? { imageUrl } : {})
    });
  });

  return events;
}
