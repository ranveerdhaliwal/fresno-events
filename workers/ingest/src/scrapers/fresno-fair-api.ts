import type { ScrapeContext, ScrapeError, ScrapeResult } from "@fresno-events/shared";

import {
  buildFresnoFairApiPayload,
  buildFresnoFairDateList,
  FRESNO_FAIR_API_URL,
  fresnoFairResponseToEvents
} from "@/scrapers/fresno-fair-api.utils";

const log = (payload: Record<string, unknown>) =>
  console.log(JSON.stringify({ event: "fresno_fair_api", ...payload }));

export async function run(ctx: ScrapeContext): Promise<ScrapeResult> {
  const started = performance.now();
  const year = ctx.now.getFullYear();
  const datesCsv = buildFresnoFairDateList(year, 10, 31);
  const payload = buildFresnoFairApiPayload(datesCsv);

  try {
    const response = await fetch(FRESNO_FAIR_API_URL, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        "User-Agent": ctx.userAgent
      },
      body: JSON.stringify(payload),
      ...(ctx.signal ? { signal: ctx.signal } : {})
    });

    if (!response.ok) {
      return finish(ctx, started, [], [
        {
          source: "fresno-fair-api",
          url: FRESNO_FAIR_API_URL,
          message: `HTTP ${response.status}`,
          recoverable: response.status >= 500 || response.status === 429
        }
      ]);
    }

    const json: unknown = await response.json();
    const events = fresnoFairResponseToEvents(json, {
      seriesId: "series:bigfresnofair:2026",
      listingUrl: "https://www.fresnofair.com/events"
    });

    log({ step: "run_end", eventsFound: events.length, dates: datesCsv.split(",").length });

    return finish(ctx, started, events, []);
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      throw error;
    }

    return finish(ctx, started, [], [
      {
        source: "fresno-fair-api",
        url: FRESNO_FAIR_API_URL,
        message: error instanceof Error ? error.message : "fresno-fair-api fetch failed",
        recoverable: true
      }
    ]);
  }
}

function finish(
  ctx: ScrapeContext,
  started: number,
  events: ScrapeResult["events"],
  errors: ScrapeError[]
): ScrapeResult {
  return {
    source: "fresno-fair-api",
    runId: ctx.runId,
    events,
    errors,
    metrics: {
      pagesVisited: 1,
      durationMs: Math.round(performance.now() - started),
      fetchUrls: [FRESNO_FAIR_API_URL]
    }
  };
}
