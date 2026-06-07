import type { ScrapeContext, ScrapeError, ScrapeResult } from "@fresno-events/shared";

import { fresnoSearchArea } from "@/sources";

import { readNumber } from "./ticketmaster.types";
import { fetchAllTicketmasterEvents, TicketmasterFetchError } from "./ticketmaster.utils";

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

  const startDateTime =
    typeof ctx.config.startDateTime === "string"
      ? ctx.config.startDateTime
      : ctx.now.toISOString().replace(/\.\d{3}Z$/, "Z");
  const endDateTime = typeof ctx.config.endDateTime === "string" ? ctx.config.endDateTime : undefined;

  try {
    const { events, pagesVisited } = await fetchAllTicketmasterEvents({
      apiKey,
      lat: fresnoSearchArea.lat,
      lng: fresnoSearchArea.lng,
      radiusMiles,
      startDateTime,
      ...(endDateTime ? { endDateTime } : {}),
      userAgent: ctx.userAgent,
      ...(ctx.signal ? { signal: ctx.signal } : {})
    });

    return createResult(ctx, events, [], pagesVisited, started);
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      throw error;
    }

    if (error instanceof TicketmasterFetchError) {
      return createResult(ctx, [], [
        {
          source: "ticketmaster",
          url: error.url,
          message: error.message,
          recoverable: error.status >= 500 || error.status === 429
        }
      ], 1, started);
    }

    return createResult(ctx, [], [
      {
        source: "ticketmaster",
        message: error instanceof Error ? error.message : "Ticketmaster ingest failed.",
        recoverable: true
      }
    ], 1, started);
  }
}

function createResult(
  ctx: ScrapeContext,
  events: ScrapeResult["events"],
  errors: ScrapeError[],
  pagesVisited: number,
  started: number
): ScrapeResult {
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
