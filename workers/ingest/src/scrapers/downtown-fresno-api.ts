import type { NormalizedEvent, ScrapeContext, ScrapeError, ScrapeResult, ScraperRun } from "@fresno-events/shared";

import type { IngestEnv } from "@/env";
import { redactCredentialsInUrl } from "@/lib/redact";

import {
  buildDowntownFresnoUrl,
  buildDowntownWindows,
  enrichDowntownEventsWithPlainDetail,
  parseDowntownFresnoHtml
} from "./downtown-fresno-api.utils";

const log = (payload: Record<string, unknown>) =>
  console.log(JSON.stringify({ event: "downtown_fresno_api", ...payload }));

export function createDowntownFresnoRunner(env: IngestEnv): ScraperRun {
  void env;
  return (ctx) => run(ctx);
}

async function run(ctx: ScrapeContext): Promise<ScrapeResult> {
  const started = performance.now();
  const errors: ScrapeError[] = [];
  const dryRun = ctx.coordinatorMode === "dry-run";

  log({ step: "run_start", dry_run: dryRun });

  let listings = await discoverListings(ctx, errors);
  let pages = listings.length;

  if (!dryRun && listings.length > 0) {
    log({ step: "detail_plain_start", count: listings.length });
    const enriched = await enrichDowntownEventsWithPlainDetail(listings, ctx.userAgent, ctx.signal);
    listings = enriched.events;
    pages += enriched.pagesVisited;
    log({ step: "detail_plain_end", pages_visited: enriched.pagesVisited });
  }

  log({
    step: "run_end",
    dry_run: dryRun,
    eventsFound: listings.length,
    errors: errors.length,
    note: "direct lane — BBQ widget + plain HTTP /do/ detail"
  });

  return finish(ctx, started, listings, errors, pages);
}

async function discoverListings(ctx: ScrapeContext, errors: ScrapeError[]): Promise<NormalizedEvent[]> {
  const events: NormalizedEvent[] = [];
  const windows = buildDowntownWindows(ctx.now);

  log({ step: "discover_start", windowCount: windows.length });

  let pages = 0;
  for (const bbqparam of windows) {
    const url = buildDowntownFresnoUrl(bbqparam);
    const safeUrl = redactCredentialsInUrl(url);
    pages += 1;

    log({ step: "window_fetch_start", page: pages, total: windows.length, bbqparam });

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
        log({ step: "window_fetch_done", bbqparam, ok: false, status: response.status });
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
        log({ step: "window_fetch_done", bbqparam, ok: false, reason: "unexpected_json" });
        continue;
      }

      const parsed = parseDowntownFresnoHtml(body, ctx.now);
      events.push(...parsed);
      log({
        step: "window_fetch_done",
        bbqparam,
        ok: true,
        eventsInWindow: parsed.length,
        totalSoFar: events.length
      });
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
      log({
        step: "window_fetch_done",
        bbqparam,
        ok: false,
        message: error instanceof Error ? error.message : "fetch failed"
      });
    }
  }

  const deduped = dedupeBySourceEventId(events);
  log({ step: "discover_end", rawCount: events.length, dedupedCount: deduped.length, pages });
  return deduped;
}

function dedupeBySourceEventId(events: NormalizedEvent[]): NormalizedEvent[] {
  const byKey = new Map<string, NormalizedEvent>();
  for (const event of events) {
    byKey.set(`${event.source}:${event.sourceEventId}`, event);
  }
  return [...byKey.values()];
}

function finish(
  ctx: ScrapeContext,
  started: number,
  events: NormalizedEvent[],
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
