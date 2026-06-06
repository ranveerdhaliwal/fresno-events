import type { ScrapeContext, ScrapeError, ScrapeResult } from "@fresno-events/shared";

import { buildMilbScheduleUrl, parseMilbSchedule, toNormalizedEvents } from "./milb-api.utils";

const log = (payload: Record<string, unknown>) =>
  console.log(JSON.stringify({ event: "milb_api", ...payload }));

export async function run(ctx: ScrapeContext): Promise<ScrapeResult> {
  const started = performance.now();
  const url = buildMilbScheduleUrl({ now: ctx.now, horizonDays: 365 });

  try {
    const response = await fetch(url, {
      headers: { "User-Agent": ctx.userAgent },
      ...(ctx.signal ? { signal: ctx.signal } : {})
    });

    if (!response.ok) {
      return finish(ctx, started, [], [
        {
          source: "milb-api",
          url,
          message: `HTTP ${response.status}`,
          recoverable: response.status >= 500 || response.status === 429
        }
      ], 1, [url]);
    }

    const json: unknown = await response.json();
    const schedule = parseMilbSchedule(json);
    const events = toNormalizedEvents(schedule);

    log({ step: "run_end", eventsFound: events.length, horizonDays: 365 });

    return finish(ctx, started, events, [], 1, [url]);
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      throw error;
    }

    return finish(ctx, started, [], [
      {
        source: "milb-api",
        url,
        message: error instanceof Error ? error.message : "milb-api fetch failed",
        recoverable: true
      }
    ], 1, [url]);
  }
}

function finish(
  ctx: ScrapeContext,
  started: number,
  events: ScrapeResult["events"],
  errors: ScrapeError[],
  pages: number,
  fetchUrls: string[]
): ScrapeResult {
  return {
    source: "milb-api",
    runId: ctx.runId,
    events,
    errors,
    metrics: {
      pagesVisited: pages,
      durationMs: Math.round(performance.now() - started),
      fetchUrls
    }
  };
}
