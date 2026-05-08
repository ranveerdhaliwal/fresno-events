import type { EventCategory, NormalizedEvent, ScrapeContext, ScrapeError, ScrapeResult } from "@fresno-events/shared";

import { fresnoSearchArea } from "@/sources";

export async function run(ctx: ScrapeContext): Promise<ScrapeResult> {
  const started = performance.now();
  const apiKey = ctx.secrets.EVENTBRITE_API_KEY?.trim();
  const radiusMiles = readNumber(ctx.config.radiusMiles) ?? fresnoSearchArea.radiusMiles;

  if (!apiKey) {
    return result(ctx, [], [
      {
        source: "eventbrite",
        message: "EVENTBRITE_API_KEY is not configured.",
        recoverable: true
      }
    ], 0, started);
  }

  const url = new URL("https://www.eventbriteapi.com/v3/events/search/");
  url.searchParams.set("location.latitude", String(fresnoSearchArea.lat));
  url.searchParams.set("location.longitude", String(fresnoSearchArea.lng));
  url.searchParams.set("location.within", `${radiusMiles}mi`);
  url.searchParams.set("expand", "venue,category");
  url.searchParams.set("start_date.range_start", ctx.now.toISOString().replace(/\.\d{3}Z$/, "Z"));

  try {
    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${apiKey}`,
        Accept: "application/json",
        "User-Agent": ctx.userAgent
      },
      ...(ctx.signal ? { signal: ctx.signal } : {})
    });

    if (!response.ok) {
      return result(ctx, [], [
        {
          source: "eventbrite",
          url: url.toString(),
          message: `Eventbrite responded with ${response.status}.`,
          recoverable: response.status >= 500 || response.status === 429
        }
      ], 1, started);
    }

    const payload = await response.json() as EventbriteResponse;
    const events = (payload.events ?? []).flatMap(toNormalizedEvent);
    return result(ctx, events, [], 1, started);
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      throw error;
    }
    return result(ctx, [], [
      {
        source: "eventbrite",
        url: url.toString(),
        message: error instanceof Error ? error.message : "Eventbrite ingest failed.",
        recoverable: true
      }
    ], 1, started);
  }
}

function result(ctx: ScrapeContext, events: NormalizedEvent[], errors: ScrapeError[], pagesVisited: number, started: number): ScrapeResult {
  return {
    source: "eventbrite",
    runId: ctx.runId,
    events,
    errors,
    metrics: { pagesVisited, durationMs: Math.round(performance.now() - started) }
  };
}

function toNormalizedEvent(event: EventbriteEvent): NormalizedEvent[] {
  if (!event.id || !event.name?.text || !event.start?.utc) {
    return [];
  }

  const venueName = event.venue?.name?.trim();
  if (!venueName) {
    return [];
  }

  return [
    {
      source: "eventbrite",
      sourceEventId: event.id,
      title: event.name.text,
      venueName,
      startTs: event.start.utc,
      timezone: event.start.timezone ?? "America/Los_Angeles",
      category: toCategory(event.category?.short_name),
      subcategories: [event.category?.name].filter(isString),
      tags: ["eventbrite", "api"],
      currency: "USD",
      ...(event.description?.text ? { descriptionText: event.description.text } : {}),
      ...(event.venue?.address?.address_1 ? { venueAddress: event.venue.address.address_1 } : {}),
      ...(event.venue?.address?.city ? { venueCity: event.venue.address.city } : { venueCity: "Fresno" }),
      ...(event.url ? { externalUrl: event.url, ticketUrl: event.url } : {}),
      ...(event.logo?.url ? { imageUrl: event.logo.url } : {})
    }
  ];
}

function toCategory(value: string | undefined): EventCategory {
  switch (value?.toLowerCase()) {
    case "music":
      return "music";
    case "performing & visual arts":
    case "arts":
      return "art";
    case "film":
      return "art";
    case "food & drink":
      return "food_drink";
    case "sports & fitness":
      return "sports";
    case "family & education":
      return "family";
    case "community":
    case "government":
      return "community";
    default:
      return "community";
  }
}

function isString(value: string | undefined): value is string {
  return Boolean(value);
}

function readNumber(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

interface EventbriteResponse {
  events?: EventbriteEvent[];
}

interface EventbriteEvent {
  id?: string;
  name?: { text?: string };
  description?: { text?: string };
  start?: { utc?: string; timezone?: string };
  url?: string;
  category?: { name?: string; short_name?: string };
  logo?: { url?: string };
  venue?: {
    name?: string;
    address?: { address_1?: string; city?: string };
  };
}
