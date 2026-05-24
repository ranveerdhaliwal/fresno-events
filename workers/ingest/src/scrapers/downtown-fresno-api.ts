import type { ScrapeContext, ScrapeError, ScrapeResult } from "@fresno-events/shared";

import { redactCredentialsInUrl } from "@/lib/redact";

import {
  buildDowntownFresnoUrl,
  buildDowntownWindows,
  parseDowntownFresnoHtml
} from "./downtown-fresno-api.utils";

const log = (payload: Record<string, unknown>) =>
  console.log(JSON.stringify({ event: "downtown_fresno_api", ...payload }));

export async function run(ctx: ScrapeContext): Promise<ScrapeResult> {
  const started = performance.now();
  const errors: ScrapeError[] = [];
  const events: ScrapeResult["events"] = [];
  const apiKey = ctx.secrets.DOWNTOWN_FRESNO_API_KEY?.trim();

  if (!apiKey) {
    return finish(ctx, started, events, [
      {
        source: "downtown-fresno-api",
        message: "DOWNTOWN_FRESNO_API_KEY is not configured.",
        recoverable: true
      }
    ], 0);
  }

  const windows = buildDowntownWindows(ctx.now);
  let pages = 0;

  for (const bbqparam of windows) {
    const url = buildDowntownFresnoUrl({ apiKey, bbqparam });
    const safeUrl = redactCredentialsInUrl(url);
    pages += 1;

    try {
      const response = await fetch(url, {
        headers: { "User-Agent": ctx.userAgent },
        ...(ctx.signal ? { signal: ctx.signal } : {})
      });

      if (!response.ok) {
        errors.push({
          source: "downtown-fresno-api",
          url: safeUrl,
          message: `HTTP ${response.status}`,
          recoverable: response.status >= 500 || response.status === 429
        });
        continue;
      }

      const contentType = response.headers.get("content-type") ?? "";
      const body = await response.text();

      if (contentType.includes("json")) {
        errors.push({
          source: "downtown-fresno-api",
          url: safeUrl,
          message: "Unexpected JSON response; HTML parser not applied.",
          recoverable: true
        });
        continue;
      }

      const parsed = parseDowntownFresnoHtml(body, ctx.now);
      log({ bbqparam, eventsInWindow: parsed.length, totalSoFar: events.length + parsed.length });
      events.push(...parsed);
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") {
        throw error;
      }
      errors.push({
        source: "downtown-fresno-api",
        url: safeUrl,
        message: error instanceof Error ? error.message : "downtown-fresno-api fetch failed",
        recoverable: true
      });
    }
  }

  log({ step: "run_end", eventsFound: events.length, pagesVisited: pages, errors: errors.length });

  return finish(ctx, started, events, errors, pages);
}

function finish(
  ctx: ScrapeContext,
  started: number,
  events: ScrapeResult["events"],
  errors: ScrapeError[],
  pages: number
): ScrapeResult {
  return {
    source: "downtown-fresno-api",
    runId: ctx.runId,
    events,
    errors,
    metrics: {
      pagesVisited: pages,
      durationMs: Math.round(performance.now() - started)
    }
  };
}
