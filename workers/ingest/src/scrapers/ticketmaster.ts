import type { EventCategory, NormalizedEvent, ScrapeContext, ScrapeError, ScrapeResult } from "@fresno-events/shared";

import { fresnoSearchArea } from "@/sources";

export async function run(ctx: ScrapeContext): Promise<ScrapeResult> {
  const started = performance.now();
  const apiKey = ctx.secrets.TICKETMASTER_API_KEY?.trim();
  const radiusMiles = readNumber(ctx.config.radiusMiles) ?? fresnoSearchArea.radiusMiles;

  if (!apiKey) {
    return createResult(ctx, [], [
      {
        source: "ticketmaster",
        message: "TICKETMASTER_API_KEY is not configured.",
        recoverable: true
      }
    ], 0, started);
  }

  const url = new URL("https://app.ticketmaster.com/discovery/v2/events.json");
  url.searchParams.set("apikey", apiKey);
  url.searchParams.set("latlong", `${fresnoSearchArea.lat},${fresnoSearchArea.lng}`);
  url.searchParams.set("radius", String(radiusMiles));
  url.searchParams.set("unit", "miles");
  url.searchParams.set("size", "100");
  url.searchParams.set("sort", "date,asc");
  url.searchParams.set("startDateTime", ctx.now.toISOString().replace(/\.\d{3}Z$/, "Z"));

  try {
    const response = await fetch(url, {
      headers: {
        Accept: "application/json",
        "User-Agent": ctx.userAgent
      },
      ...(ctx.signal ? { signal: ctx.signal } : {})
    });

    if (!response.ok) {
      return createResult(ctx, [], [
        {
          source: "ticketmaster",
          url: url.toString(),
          message: `Ticketmaster responded with ${response.status}.`,
          recoverable: response.status >= 500 || response.status === 429
        }
      ], 1, started);
    }

    const payload = await response.json() as TicketmasterResponse;
    const events = payload._embedded?.events ?? [];

    return createResult(ctx, events.flatMap(toNormalizedEvent), [], 1, started);
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      throw error;
    }

    return createResult(ctx, [], [
      {
        source: "ticketmaster",
        url: url.toString(),
        message: error instanceof Error ? error.message : "Ticketmaster ingest failed.",
        recoverable: true
      }
    ], 1, started);
  }
}

function createResult(ctx: ScrapeContext, events: NormalizedEvent[], errors: ScrapeError[], pagesVisited: number, started: number): ScrapeResult {
  return {
    source: "ticketmaster",
    runId: ctx.runId,
    events,
    errors,
    metrics: {
      pagesVisited,
      durationMs: Math.round(performance.now() - started)
    }
  };
}

function toNormalizedEvent(event: TicketmasterEvent): NormalizedEvent[] {
  const startTs = event.dates?.start?.dateTime ?? toLocalDateTime(event.dates?.start?.localDate, event.dates?.start?.localTime);
  const venue = event._embedded?.venues?.[0];

  if (!event.id || !event.name || !startTs || !venue?.name) {
    return [];
  }

  const priceRange = event.priceRanges?.[0];
  const image = chooseImage(event.images);
  const category = toCategory(event.classifications?.[0]);

  return [
    {
      source: "ticketmaster",
      sourceEventId: event.id,
      title: event.name,
      venueName: venue.name,
      startTs,
      timezone: event.dates?.timezone ?? "America/Los_Angeles",
      category,
      subcategories: event.classifications?.flatMap((classification) => [classification.segment?.name, classification.genre?.name, classification.subGenre?.name].filter(isString)) ?? [],
      tags: ["ticketmaster", "api"],
      currency: priceRange?.currency ?? "USD",
      ...(event.info ? { descriptionText: event.info } : {}),
      ...(venue.address?.line1 ? { venueAddress: venue.address.line1 } : {}),
      ...(venue.city?.name ? { venueCity: venue.city.name } : { venueCity: "Fresno" }),
      ...(priceRange?.min !== undefined ? { priceMin: priceRange.min } : {}),
      ...(priceRange?.max !== undefined ? { priceMax: priceRange.max } : {}),
      ...(event.url ? { externalUrl: event.url, ticketUrl: event.url } : {}),
      ...(image?.url ? { imageUrl: image.url } : {})
    }
  ];
}

function toLocalDateTime(localDate?: string, localTime?: string) {
  if (!localDate) {
    return null;
  }

  return `${localDate}T${localTime ?? "00:00:00"}-07:00`;
}

function chooseImage(images: TicketmasterImage[] | undefined) {
  return [...(images ?? [])].sort((a, b) => (b.width ?? 0) - (a.width ?? 0))[0];
}

function toCategory(classification: TicketmasterClassification | undefined): EventCategory {
  const segment = classification?.segment?.name?.toLowerCase() ?? "";
  const genre = classification?.genre?.name?.toLowerCase() ?? "";
  const values = `${segment} ${genre}`;

  if (values.includes("music")) return "music";
  if (values.includes("comedy")) return "comedy";
  if (values.includes("theatre") || values.includes("theater")) return "theater";
  if (values.includes("sport")) return "sports";
  if (values.includes("family")) return "family";
  if (values.includes("arts")) return "art";

  return "community";
}

function isString(value: string | undefined): value is string {
  return Boolean(value);
}

function readNumber(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

interface TicketmasterResponse {
  _embedded?: {
    events?: TicketmasterEvent[];
  };
}

interface TicketmasterEvent {
  id?: string;
  name?: string;
  url?: string;
  info?: string;
  dates?: {
    timezone?: string;
    start?: {
      dateTime?: string;
      localDate?: string;
      localTime?: string;
    };
  };
  classifications?: TicketmasterClassification[];
  priceRanges?: Array<{
    min?: number;
    max?: number;
    currency?: string;
  }>;
  images?: TicketmasterImage[];
  _embedded?: {
    venues?: TicketmasterVenue[];
  };
}

interface TicketmasterClassification {
  segment?: {
    name?: string;
  };
  genre?: {
    name?: string;
  };
  subGenre?: {
    name?: string;
  };
}

interface TicketmasterVenue {
  name?: string;
  address?: {
    line1?: string;
  };
  city?: {
    name?: string;
  };
}

interface TicketmasterImage {
  url?: string;
  width?: number;
}
