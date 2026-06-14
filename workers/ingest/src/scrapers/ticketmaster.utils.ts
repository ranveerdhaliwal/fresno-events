import type { NormalizedEvent } from "@fresno-events/shared";

import { sleep } from "@/lib/sleep";
import {
  chooseImage,
  isString,
  readCoordinate,
  toCategory,
  toLocalDateTime,
  type TicketmasterEvent,
  type TicketmasterResponse
} from "./ticketmaster.types";

const TM_API = "https://app.ticketmaster.com/discovery/v2/events.json";
const PAGE_SIZE = 200;
const DEEP_PAGING_CAP = 1000;
const RATE_LIMIT_RETRY_MS = 1_000;

export interface TicketmasterFetchOptions {
  apiKey: string;
  lat: number;
  lng: number;
  radiusMiles: number;
  startDateTime: string;
  endDateTime?: string;
  userAgent: string;
  signal?: AbortSignal;
}

export class TicketmasterFetchError extends Error {
  constructor(
    readonly status: number,
    readonly url: string,
    message: string
  ) {
    super(message);
    this.name = "TicketmasterFetchError";
  }
}

export function toNormalizedEvent(event: TicketmasterEvent): NormalizedEvent[] {
  const startTs = event.dates?.start?.dateTime ?? toLocalDateTime(event.dates?.start?.localDate, event.dates?.start?.localTime);
  const venue = event._embedded?.venues?.[0];

  if (!event.id || !event.name || !startTs || !venue?.name) {
    return [];
  }

  const priceRange = event.priceRanges?.[0];
  const image = chooseImage(event.images);
  const category = toCategory(event.classifications?.[0]);
  const venueLat = readCoordinate(venue.location?.latitude);
  const venueLng = readCoordinate(venue.location?.longitude);

  return [
    {
      source: "ticketmaster",
      sourceEventId: event.id,
      title: event.name,
      venueName: venue.name,
      startTs,
      timezone: event.dates?.timezone ?? "America/Los_Angeles",
      category,
      subcategories:
        event.classifications?.flatMap((classification) =>
          [classification.segment?.name, classification.genre?.name, classification.subGenre?.name].filter(isString)
        ) ?? [],
      tags: ["ticketmaster", "api"],
      currency: priceRange?.currency ?? "USD",
      ...(event.info ? { descriptionText: event.info } : {}),
      ...(venue.address?.line1 ? { venueAddress: venue.address.line1 } : {}),
      ...(venue.city?.name ? { venueCity: venue.city.name } : { venueCity: "Fresno" }),
      ...(venueLat !== undefined ? { venueLat } : {}),
      ...(venueLng !== undefined ? { venueLng } : {}),
      ...(priceRange?.min !== undefined ? { priceMin: priceRange.min } : {}),
      ...(priceRange?.max !== undefined ? { priceMax: priceRange.max } : {}),
      ...(event.url ? { externalUrl: event.url, ticketUrl: event.url } : {}),
      ...(image?.url ? { imageUrl: image.url } : {})
    }
  ];
}

function buildPageUrl(opts: TicketmasterFetchOptions, page: number): string {
  const url = new URL(TM_API);
  url.searchParams.set("apikey", opts.apiKey);
  url.searchParams.set("latlong", `${opts.lat},${opts.lng}`);
  url.searchParams.set("radius", String(opts.radiusMiles));
  url.searchParams.set("unit", "miles");
  url.searchParams.set("size", String(PAGE_SIZE));
  url.searchParams.set("sort", "date,asc");
  url.searchParams.set("startDateTime", opts.startDateTime);
  url.searchParams.set("countryCode", "US");
  url.searchParams.set("stateCode", "CA");
  url.searchParams.set("page", String(page));
  if (opts.endDateTime) {
    url.searchParams.set("endDateTime", opts.endDateTime);
  }
  return url.toString();
}

async function fetchTicketmasterPage(
  url: string,
  userAgent: string,
  signal?: AbortSignal,
  retryOn429 = true
): Promise<Response> {
  const response = await fetch(url, {
    headers: { Accept: "application/json", "User-Agent": userAgent },
    ...(signal ? { signal } : {})
  });

  const rateLimitAvailable = response.headers.get("Rate-Limit-Available");
  if (rateLimitAvailable) {
    console.log(JSON.stringify({ event: "ticketmaster_rate_limit", available: rateLimitAvailable }));
  }

  if (response.status === 429 && retryOn429) {
    await sleep(RATE_LIMIT_RETRY_MS);
    return fetchTicketmasterPage(url, userAgent, signal, false);
  }

  return response;
}

export async function fetchAllTicketmasterEvents(
  opts: TicketmasterFetchOptions
): Promise<{ events: NormalizedEvent[]; pagesVisited: number }> {
  const all: NormalizedEvent[] = [];
  let page = 0;
  let totalPages = 1;
  let pagesVisited = 0;

  while (page < totalPages) {
    const url = buildPageUrl(opts, page);
    const response = await fetchTicketmasterPage(url, opts.userAgent, opts.signal);

    pagesVisited += 1;

    if (!response.ok) {
      throw new TicketmasterFetchError(response.status, url, `Ticketmaster responded with ${response.status}.`);
    }

    const payload = (await response.json()) as TicketmasterResponse;
    const raw = payload._embedded?.events ?? [];
    all.push(...raw.flatMap(toNormalizedEvent));

    const pageMeta = payload.page;
    totalPages = pageMeta?.totalPages ?? page + 1;
    page += 1;

    if (PAGE_SIZE * page >= DEEP_PAGING_CAP) {
      break;
    }
  }

  return { events: all, pagesVisited };
}
