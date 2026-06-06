import type { ScrapeContext, ScrapeError, ScrapeResult } from "@fresno-events/shared";

import {
  buildGobulldogsCalendarApiUrl,
  gobulldogsCalendarDaysToEvents,
  parseGobulldogsCalendarDays
} from "@/scrapers/gobulldogs-calendar.utils";

const log = (payload: Record<string, unknown>) =>
  console.log(JSON.stringify({ event: "gobulldogs_api", ...payload }));

export async function run(ctx: ScrapeContext): Promise<ScrapeResult> {
  const started = performance.now();
  const url = buildGobulldogsCalendarApiUrl(ctx.now, 90);
  const fetchUrls = [url];

  try {
    const response = await fetch(url, {
      headers: { Accept: "application/json", "User-Agent": ctx.userAgent },
      ...(ctx.signal ? { signal: ctx.signal } : {})
    });

    if (!response.ok) {
      return finish(ctx, started, [], [
        {
          source: "gobulldogs-api",
          url,
          message: `HTTP ${response.status}`,
          recoverable: response.status >= 500 || response.status === 429
        }
      ], fetchUrls);
    }

    const json: unknown = await response.json();
    const days = parseGobulldogsCalendarDays(json);
    const events = gobulldogsCalendarDaysToEvents(days);

    log({ step: "run_end", eventsFound: events.length, horizonDays: 90, days: days.length });

    return finish(ctx, started, events, [], fetchUrls);
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      throw error;
    }

    return finish(ctx, started, [], [
      {
        source: "gobulldogs-api",
        url,
        message: error instanceof Error ? error.message : "gobulldogs-api fetch failed",
        recoverable: true
      }
    ], fetchUrls);
  }
}

function finish(
  ctx: ScrapeContext,
  started: number,
  events: ScrapeResult["events"],
  errors: ScrapeError[],
  fetchUrls: string[]
): ScrapeResult {
  return {
    source: "gobulldogs-api",
    runId: ctx.runId,
    events,
    errors,
    metrics: {
      pagesVisited: 1,
      durationMs: Math.round(performance.now() - started),
      fetchUrls
    }
  };
}
