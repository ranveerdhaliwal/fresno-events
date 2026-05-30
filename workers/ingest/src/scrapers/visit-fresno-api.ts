import type { ScrapeContext, ScrapeError, ScrapeResult } from "@fresno-events/shared";

import { redactCredentialsInUrl } from "@/lib/redact";

import { VisitFresnoResponseSchema } from "./visit-fresno-api.types";
import {
  buildVisitFresnoDateRanges,
  buildVisitFresnoUrl,
  extractVisitFresnoDocs,
  resolveVisitFresnoApiToken,
  toNormalizedEvent,
  visitFresnoTotalCount
} from "./visit-fresno-api.utils";

const log = (payload: Record<string, unknown>) =>
  console.log(JSON.stringify({ event: "visit_fresno_api", ...payload }));

export async function run(ctx: ScrapeContext): Promise<ScrapeResult> {
  const started = performance.now();
  const errors: ScrapeError[] = [];
  const events: ScrapeResult["events"] = [];
  const token = await resolveVisitFresnoApiToken({
    userAgent: ctx.userAgent,
    fallbackToken: ctx.secrets.VISIT_FRESNO_API_TOKEN,
    ...(ctx.signal ? { signal: ctx.signal } : {})
  });

  if (!token) {
    return finish(ctx, started, events, [
      {
        source: "visit-fresno-api",
        message: "Visit Fresno API token could not be fetched from get_simple_token.",
        recoverable: true
      }
    ], 0);
  }

  log({ step: "token_ready", source: "get_simple_token" });
  const limit = 50;
  const ranges = buildVisitFresnoDateRanges(ctx.now);
  let pages = 0;

  for (const range of ranges) {
    let skip = 0;
    let totalCount: number | undefined;

    while (pages < 40) {
      const url = buildVisitFresnoUrl({ token, skip, limit, range });
      const safeUrl = redactCredentialsInUrl(url);
      pages += 1;

      const page = await fetchVisitFresnoPage(ctx, url, safeUrl);
      if (!page.ok) {
        errors.push(page.error);
        if (!page.error.recoverable) {
          break;
        }
        break;
      }

      const docs = page.docs;
      totalCount = page.totalCount ?? totalCount;

      log({
        rangeStart: range.start.toISOString().slice(0, 10),
        rangeEnd: range.end.toISOString().slice(0, 10),
        skip,
        pageCount: docs.length,
        totalSoFar: events.length + docs.length,
        totalCount
      });

      if (docs.length === 0) {
        break;
      }

      for (const doc of docs) {
        const event = toNormalizedEvent(doc);
        if (event) {
          events.push(event);
        }
      }

      skip += limit;
      if (totalCount !== undefined && skip >= totalCount) {
        break;
      }
    }
  }

  log({ step: "run_end", eventsFound: events.length, pagesVisited: pages, errors: errors.length });

  return finish(ctx, started, events, errors, pages);
}

async function fetchVisitFresnoPage(
  ctx: ScrapeContext,
  url: string,
  safeUrl: string
): Promise<
  | { ok: true; docs: ReturnType<typeof extractVisitFresnoDocs>; totalCount?: number }
  | { ok: false; error: ScrapeError }
> {
  try {
    const response = await fetch(url, {
      headers: { "User-Agent": ctx.userAgent },
      ...(ctx.signal ? { signal: ctx.signal } : {})
    });

    if (!response.ok) {
      return {
        ok: false,
        error: {
          source: "visit-fresno-api",
          url: safeUrl,
          message: `HTTP ${response.status}`,
          recoverable: response.status >= 500 || response.status === 429
        }
      };
    }

    const json: unknown = await response.json();
    const parsed = VisitFresnoResponseSchema.safeParse(json);
    if (!parsed.success) {
      return {
        ok: false,
        error: {
          source: "visit-fresno-api",
          url: safeUrl,
          message: `shape mismatch: ${parsed.error.message}`,
          recoverable: true
        }
      };
    }

    const totalCount = visitFresnoTotalCount(parsed.data);
    return {
      ok: true,
      docs: extractVisitFresnoDocs(parsed.data),
      ...(totalCount !== undefined ? { totalCount } : {})
    };
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      throw error;
    }
    return {
      ok: false,
      error: {
        source: "visit-fresno-api",
        url: safeUrl,
        message: error instanceof Error ? error.message : "visit-fresno-api fetch failed",
        recoverable: true
      }
    };
  }
}

function finish(
  ctx: ScrapeContext,
  started: number,
  events: ScrapeResult["events"],
  errors: ScrapeError[],
  pages: number
): ScrapeResult {
  return {
    source: "visit-fresno-api",
    runId: ctx.runId,
    events,
    errors,
    metrics: {
      pagesVisited: pages,
      durationMs: Math.round(performance.now() - started)
    }
  };
}
