import type { ScrapeContext, ScrapeError, ScrapeResult } from "@fresno-events/shared";

import {
  buildFresnoFairApiPayload,
  buildFresnoFairDateList,
  FRESNO_FAIR_API_URL,
  FRESNO_FAIR_SEASON_DAY_COUNT,
  FRESNO_FAIR_SEASON_MONTH,
  fresnoFairResponseToEvents,
  fresnoFairScheduleYearsToTry,
  resolveFresnoFairScheduleYear,
  seriesIdForFresnoFairSeasonYear
} from "@/scrapers/fresno-fair-api.utils";

const log = (payload: Record<string, unknown>) =>
  console.log(JSON.stringify({ event: "fresno_fair_api", ...payload }));

export interface FresnoFairApiRunOptions {
  seriesId?: string;
  listingUrl?: string;
}

export async function run(
  ctx: ScrapeContext,
  options: FresnoFairApiRunOptions = {}
): Promise<ScrapeResult> {
  const started = performance.now();
  const listingUrl = options.listingUrl ?? "https://www.fresnofair.com/events";
  const primaryYear = resolveFresnoFairScheduleYear(ctx.now, options.seriesId);
  const yearsToTry = fresnoFairScheduleYearsToTry(primaryYear);

  let events: ScrapeResult["events"] = [];
  const errors: ScrapeError[] = [];
  let resolvedYear = primaryYear;
  let datesQueried = 0;

  try {
    for (const year of yearsToTry) {
      const datesCsv = buildFresnoFairDateList(year, FRESNO_FAIR_SEASON_MONTH, FRESNO_FAIR_SEASON_DAY_COUNT);
      const payload = buildFresnoFairApiPayload(datesCsv);
      datesQueried = datesCsv.split(",").length;

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
        errors.push({
          source: "fresno-fair-api",
          url: FRESNO_FAIR_API_URL,
          message: `HTTP ${response.status} (season year ${year})`,
          recoverable: response.status >= 500 || response.status === 429
        });
        continue;
      }

      const json: unknown = await response.json();
      const yearEvents = fresnoFairResponseToEvents(json, {
        seriesId: seriesIdForFresnoFairSeasonYear(year, options.seriesId),
        listingUrl
      });
      if (yearEvents.length > 0) {
        events = yearEvents;
        resolvedYear = year;
        break;
      }
    }

    log({
      step: "run_end",
      eventsFound: events.length,
      dates: datesQueried,
      seasonYear: resolvedYear,
      yearsTried: yearsToTry
    });

    return finish(ctx, started, events, errors);
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      throw error;
    }

    return finish(ctx, started, [], [
      ...errors,
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
