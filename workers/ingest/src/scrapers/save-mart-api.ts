import type { ScrapeContext, ScrapeError, ScrapeResult } from "@fresno-events/shared";

import {
  buildSaveMartApiQuery,
  buildSaveMartApiUrl,
  extractSaveMartTokenFromHtml,
  parseSaveMartApiResponse,
  parseSaveMartSimpleToken,
  SAVE_MART_API_PATH,
  SAVE_MART_LISTING_URL,
  SAVE_MART_SIMPLE_TOKEN_URL,
  saveMartDocsToEvents
} from "@/scrapers/save-mart-api.utils";
import { buildSaveMartApiMonthRanges } from "@/venues/_shared/month-windows.utils";

const PAGE_LIMIT = 50;

const log = (payload: Record<string, unknown>) =>
  console.log(JSON.stringify({ event: "save_mart_api", ...payload }));

export async function run(ctx: ScrapeContext): Promise<ScrapeResult> {
  const started = performance.now();
  const fetchUrls: string[] = [];

  const token = await resolveToken(ctx, fetchUrls);
  if (!token) {
    return finish(ctx, started, [], [
      {
        source: "save-mart-api",
        url: SAVE_MART_SIMPLE_TOKEN_URL,
        message:
          "Save Mart API token missing — could not fetch get_simple_token (optional override: SAVE_MART_EVENTS_TOKEN)",
        recoverable: true
      }
    ], fetchUrls);
  }

  const horizonMonths =
    typeof ctx.config.monthWindows === "number" && ctx.config.monthWindows > 0
      ? ctx.config.monthWindows
      : 6;
  const monthRanges = buildSaveMartApiMonthRanges(horizonMonths, ctx.now);
  const allDocs: unknown[] = [];
  const seenRecids = new Set<string>();
  const errors: ScrapeError[] = [];

  for (const range of monthRanges) {
    let skip = 0;
    let pages = 0;
    let monthFailed = false;

    while (pages < 20) {
      const query = buildSaveMartApiQuery({
        start: range.start,
        end: range.end,
        skip,
        limit: PAGE_LIMIT
      });
      const url = buildSaveMartApiUrl(query, token);
      fetchUrls.push(url);

      const response = await fetch(url, {
        headers: {
          Accept: "application/json",
          "User-Agent": ctx.userAgent,
          Referer: SAVE_MART_LISTING_URL
        },
        ...(ctx.signal ? { signal: ctx.signal } : {})
      });

      if (!response.ok) {
        const recoverable = response.status >= 500 || response.status === 429;
        const scrapeError: ScrapeError = {
          source: "save-mart-api",
          url,
          message: `HTTP ${response.status} (${range.startYmd}..${range.endYmd})`,
          recoverable
        };
        if (recoverable) {
          errors.push(scrapeError);
          log({ step: "month_window_error", status: response.status, range: range.startYmd });
          monthFailed = true;
          break;
        }
        return finish(ctx, started, saveMartDocsToEvents(allDocs), [scrapeError, ...errors], fetchUrls);
      }

      const json: unknown = await response.json();
      const batch = parseSaveMartApiResponse(json);
      for (const doc of batch.docs) {
        const recid =
          doc && typeof doc === "object" && "recid" in doc ? String((doc as { recid: unknown }).recid) : null;
        if (recid && seenRecids.has(recid)) {
          continue;
        }
        if (recid) {
          seenRecids.add(recid);
        }
        allDocs.push(doc);
      }

      pages += 1;
      if (batch.docs.length < PAGE_LIMIT) {
        break;
      }
      skip += PAGE_LIMIT;
    }

    if (monthFailed) {
      continue;
    }
  }

  const events = saveMartDocsToEvents(allDocs);
  log({
    step: "run_end",
    eventsFound: events.length,
    docs: allDocs.length,
    monthWindows: monthRanges.length,
    recoverableErrors: errors.length
  });

  return finish(ctx, started, events, errors, fetchUrls);
}

async function resolveToken(ctx: ScrapeContext, fetchUrls: string[]): Promise<string | null> {
  const fromEnv = ctx.secrets.SAVE_MART_EVENTS_TOKEN?.trim();
  if (fromEnv) {
    return fromEnv;
  }

  fetchUrls.push(SAVE_MART_SIMPLE_TOKEN_URL);
  const tokenResponse = await fetch(SAVE_MART_SIMPLE_TOKEN_URL, {
    headers: {
      Accept: "text/plain",
      "User-Agent": ctx.userAgent,
      Referer: SAVE_MART_LISTING_URL
    },
    ...(ctx.signal ? { signal: ctx.signal } : {})
  });

  if (tokenResponse.ok) {
    const token = parseSaveMartSimpleToken(await tokenResponse.text());
    if (token) {
      return token;
    }
  }

  fetchUrls.push(SAVE_MART_LISTING_URL);
  const listingResponse = await fetch(SAVE_MART_LISTING_URL, {
    headers: { Accept: "text/html", "User-Agent": ctx.userAgent },
    ...(ctx.signal ? { signal: ctx.signal } : {})
  });
  if (!listingResponse.ok) {
    return null;
  }
  return extractSaveMartTokenFromHtml(await listingResponse.text());
}

function finish(
  ctx: ScrapeContext,
  started: number,
  events: ScrapeResult["events"],
  errors: ScrapeError[],
  fetchUrls: string[]
): ScrapeResult {
  return {
    source: "save-mart-api",
    runId: ctx.runId,
    events,
    errors,
    metrics: {
      pagesVisited: fetchUrls.length,
      durationMs: Math.round(performance.now() - started),
      fetchUrls: fetchUrls.length > 0 ? fetchUrls : [SAVE_MART_API_PATH, SAVE_MART_SIMPLE_TOKEN_URL]
    }
  };
}
