import type {
  ScrapeContext,
  ScrapeError,
  ScrapeResult,
} from "@fresno-events/shared";

import {
  buildFresnoFairApiPayload,
  buildFresnoFairDateList,
  FRESNO_FAIR_API_URL,
  fresnoFairResponseToEvents,
  resolveFresnoFairScheduleYear,
  seriesIdForFresnoFairSeasonYear,
} from "@/scrapers/fresno-fair-api.utils";

const log = (payload: Record<string, unknown>) =>
  console.log(JSON.stringify({ event: "fresno_fair_api", ...payload }));

export interface FresnoFairApiRunOptions {
  seriesId?: string;
  listingUrl?: string;
}

export async function run(
  ctx: ScrapeContext,
  options: FresnoFairApiRunOptions = {},
): Promise<ScrapeResult> {
  const started = performance.now();
  const listingUrl = options.listingUrl ?? "https://www.fresnofair.com/events";
  const primaryYear = resolveFresnoFairScheduleYear(ctx.now, options.seriesId);
  // Annual discovery and a rolling 180-day Fairgrounds window are separate
  // queries. A nonempty old month must never suppress another window.
  const windows = new Map<string, { year: number; month: number }>();
  windows.set(`${primaryYear}-10`, { year: primaryYear, month: 10 });
  const localDate = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Los_Angeles",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(ctx.now);
  const startMonth = new Date(`${localDate.slice(0, 7)}-01T12:00:00Z`);
  const until = new Date(ctx.now.getTime() + 180 * 86_400_000);
  for (let offset = 0; offset <= 6; offset++) {
    const date = new Date(
      Date.UTC(
        startMonth.getUTCFullYear(),
        startMonth.getUTCMonth() + offset,
        1,
        12,
      ),
    );
    if (date > until) break;
    windows.set(`${date.getUTCFullYear()}-${date.getUTCMonth() + 1}`, {
      year: date.getUTCFullYear(),
      month: date.getUTCMonth() + 1,
    });
  }

  let events: ScrapeResult["events"] = [];
  const errors: ScrapeError[] = [];
  let resolvedYear = primaryYear;
  let datesQueried = 0;
  let requests = 0;

  try {
    for (const { year, month } of windows.values()) {
      const days = new Date(Date.UTC(year, month, 0)).getUTCDate();
      const datesCsv = buildFresnoFairDateList(year, month, days);
      const payload = buildFresnoFairApiPayload(datesCsv);
      datesQueried += days;

      requests++;
      const response = await fetch(FRESNO_FAIR_API_URL, {
        method: "POST",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
          "User-Agent": ctx.userAgent,
        },
        body: JSON.stringify(payload),
        ...(ctx.signal ? { signal: ctx.signal } : {}),
      });

      if (!response.ok) {
        errors.push({
          source: "fresno-fair-api",
          url: FRESNO_FAIR_API_URL,
          message: `HTTP ${response.status} (season year ${year})`,
          recoverable: response.status >= 500 || response.status === 429,
        });
        continue;
      }

      const json: unknown = await response.json();
      const yearEvents = fresnoFairResponseToEvents(json, {
        seriesId: seriesIdForFresnoFairSeasonYear(year, options.seriesId),
        listingUrl,
      });
      events.push(
        ...yearEvents.filter(
          (event) =>
            Date.parse(event.startTs) >= ctx.now.getTime() &&
            ((month === 10 && year === primaryYear) ||
              Date.parse(event.startTs) < until.getTime()),
        ),
      );
    }

    log({
      step: "run_end",
      eventsFound: events.length,
      dates: datesQueried,
      seasonYear: resolvedYear,
      windowsQueried: [...windows.values()],
    });

    return finish(
      ctx,
      started,
      [
        ...new Map(
          events.map((event) => [event.sourceEventId, event]),
        ).values(),
      ],
      errors,
      requests,
    );
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      throw error;
    }

    return finish(
      ctx,
      started,
      [],
      [
        ...errors,
        {
          source: "fresno-fair-api",
          url: FRESNO_FAIR_API_URL,
          message:
            error instanceof Error
              ? error.message
              : "fresno-fair-api fetch failed",
          recoverable: true,
        },
      ],
      requests,
    );
  }
}

function finish(
  ctx: ScrapeContext,
  started: number,
  events: ScrapeResult["events"],
  errors: ScrapeError[],
  requests: number,
): ScrapeResult {
  return {
    source: "fresno-fair-api",
    runId: ctx.runId,
    events,
    errors,
    metrics: {
      pagesVisited: requests,
      durationMs: Math.round(performance.now() - started),
      fetchUrls: [FRESNO_FAIR_API_URL],
    },
  };
}
