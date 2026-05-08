import type { EventCategory, NormalizedEvent, ScrapeContext, ScrapeError, ScrapeResult } from "@fresno-events/shared";

import { fresnoSearchArea } from "@/sources";

export async function run(ctx: ScrapeContext): Promise<ScrapeResult> {
  const started = performance.now();
  const clientId = ctx.secrets.SEATGEEK_CLIENT_ID?.trim();
  const radiusMiles = readNumber(ctx.config.radiusMiles) ?? fresnoSearchArea.radiusMiles;
  const perPage = 50;

  if (!clientId) {
    return result(ctx, [], [
      {
        source: "seatgeek",
        message: "SEATGEEK_CLIENT_ID is not configured.",
        recoverable: true
      }
    ], 0, started);
  }

  const url = new URL("https://api.seatgeek.com/2/events");
  url.searchParams.set("client_id", clientId);
  url.searchParams.set("lat", String(fresnoSearchArea.lat));
  url.searchParams.set("lon", String(fresnoSearchArea.lng));
  url.searchParams.set("range", `${radiusMiles}mi`);
  url.searchParams.set("per_page", String(perPage));
  url.searchParams.set("sort", "datetime_local.asc");
  url.searchParams.set("datetime_utc.gte", ctx.now.toISOString());

  const clientSecret = ctx.secrets.SEATGEEK_CLIENT_SECRET?.trim();
  const headers: HeadersInit = {
    Accept: "application/json",
    "User-Agent": ctx.userAgent
  };
  if (clientSecret) {
    headers.Authorization = `Basic ${btoa(`${clientId}:${clientSecret}`)}`;
  }

  try {
    const response = await fetch(url, {
      headers,
      ...(ctx.signal ? { signal: ctx.signal } : {})
    });

    if (!response.ok) {
      return result(ctx, [], [
        {
          source: "seatgeek",
          url: url.toString(),
          message: `SeatGeek responded with ${response.status}.`,
          recoverable: response.status >= 500 || response.status === 429
        }
      ], 1, started);
    }

    const payload = await response.json() as SeatGeekResponse;
    const events = (payload.events ?? []).flatMap(toNormalizedEvent);
    return result(ctx, events, [], 1, started);
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      throw error;
    }
    return result(ctx, [], [
      {
        source: "seatgeek",
        url: url.toString(),
        message: error instanceof Error ? error.message : "SeatGeek ingest failed.",
        recoverable: true
      }
    ], 1, started);
  }
}

function result(ctx: ScrapeContext, events: NormalizedEvent[], errors: ScrapeError[], pagesVisited: number, started: number): ScrapeResult {
  return {
    source: "seatgeek",
    runId: ctx.runId,
    events,
    errors,
    metrics: { pagesVisited, durationMs: Math.round(performance.now() - started) }
  };
}

function toNormalizedEvent(event: SeatGeekEvent): NormalizedEvent[] {
  if (!event.id || !event.title || !event.datetime_utc) {
    return [];
  }

  const venue = event.venue;
  const venueName = venue?.name?.trim();
  if (!venueName) {
    return [];
  }

  const url = event.url;
  const startTs = ensureZ(event.datetime_utc);
  const priceMin = event.stats?.lowest_price ?? undefined;
  const priceMax = event.stats?.highest_price ?? undefined;

  return [
    {
      source: "seatgeek",
      sourceEventId: String(event.id),
      title: event.title,
      venueName,
      startTs,
      timezone: event.venue?.timezone ?? "America/Los_Angeles",
      category: toCategory(event.type),
      subcategories: event.taxonomies?.map((t) => t.name).filter(isString) ?? [],
      tags: ["seatgeek", "api"],
      currency: "USD",
      ...(event.description ? { descriptionText: event.description } : {}),
      ...(venue?.address ? { venueAddress: venue.address } : {}),
      ...(venue?.city ? { venueCity: venue.city } : { venueCity: "Fresno" }),
      ...(typeof priceMin === "number" ? { priceMin } : {}),
      ...(typeof priceMax === "number" ? { priceMax } : {}),
      ...(url ? { externalUrl: url, ticketUrl: url } : {}),
      ...(event.performers?.[0]?.image ? { imageUrl: event.performers[0].image } : {})
    }
  ];
}

function toCategory(type: string | undefined): EventCategory {
  switch (type) {
    case "concert":
    case "music_festival":
      return "music";
    case "comedy":
      return "comedy";
    case "theater":
      return "theater";
    case "sports":
    case "mlb":
    case "nfl":
    case "nba":
    case "nhl":
      return "sports";
    case "family":
      return "family";
    default:
      return "community";
  }
}

function ensureZ(value: string) {
  return value.endsWith("Z") || value.includes("+") ? value : `${value}Z`;
}

function isString(value: string | undefined): value is string {
  return Boolean(value);
}

function readNumber(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

interface SeatGeekResponse {
  events?: SeatGeekEvent[];
}

interface SeatGeekEvent {
  id?: number;
  title?: string;
  url?: string;
  description?: string;
  type?: string;
  datetime_utc?: string;
  venue?: {
    name?: string;
    address?: string;
    city?: string;
    timezone?: string;
  };
  stats?: {
    lowest_price?: number;
    highest_price?: number;
  };
  performers?: Array<{ image?: string }>;
  taxonomies?: Array<{ name?: string }>;
}
