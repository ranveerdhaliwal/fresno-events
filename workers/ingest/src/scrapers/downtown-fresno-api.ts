import type { NormalizedEvent, ScrapeContext, ScrapeError, ScrapeResult, ScraperRun } from "@fresno-events/shared";

import { extractEventsFromMarkdown } from "@/ai/extractor";
import { renderUrlToMarkdown } from "@/browser-rendering/render-page";
import type { IngestEnv } from "@/env";
import { redactCredentialsInUrl } from "@/lib/redact";
import { getJsonPromptBackend } from "@/llm/registry";

import {
  buildDowntownFresnoUrl,
  buildDowntownWindows,
  DOWNTOWN_DETAIL_DELAY_MS,
  DOWNTOWN_DETAIL_URL_CAP,
  mergeListingWithDetail,
  parseDowntownFresnoHtml
} from "./downtown-fresno-api.utils";

const log = (payload: Record<string, unknown>) =>
  console.log(JSON.stringify({ event: "downtown_fresno_api", ...payload }));

function canEnrichDetails(env: IngestEnv): boolean {
  const hasBr =
    Boolean(env.CLOUDFLARE_ACCOUNT_ID?.trim()) && Boolean(env.CLOUDFLARE_API_TOKEN?.trim());
  const hasLlm = Boolean(getJsonPromptBackend(env, "discovery"));
  return hasBr && hasLlm;
}

export function createDowntownFresnoRunner(env: IngestEnv): ScraperRun {
  return (ctx) => run(ctx, env);
}

async function run(ctx: ScrapeContext, env: IngestEnv): Promise<ScrapeResult> {
  const started = performance.now();
  const errors: ScrapeError[] = [];
  const dryRun = ctx.coordinatorMode === "dry-run";

  const listings = await discoverListings(ctx, errors);
  const enrichDetails = canEnrichDetails(env);

  if (!enrichDetails) {
    log({
      step: "detail_skip",
      reason: "BR or LLM not configured — listing-only",
      listings: listings.length
    });
    return finish(ctx, started, listings, errors, listings.length);
  }

  const detailUrls = uniqueDetailUrls(listings).slice(0, DOWNTOWN_DETAIL_URL_CAP);

  if (dryRun) {
    log({
      step: "downtown_detail_plan",
      listingCount: listings.length,
      detailUrlCount: detailUrls.length,
      note: "dry-run — no Browser Rendering jobs started"
    });
    return finish(ctx, started, listings, errors, listings.length);
  }

  log({ step: "detail_enrich_start", detailUrlCount: detailUrls.length });

  const byUrl = new Map(
    listings
      .filter((e) => e.externalUrl?.startsWith("http"))
      .map((e) => [e.externalUrl!, e])
  );
  const bySourceEventId = new Map(listings.map((e) => [e.sourceEventId, e]));
  let brPages = 0;

  for (const url of detailUrls) {
    const listing = byUrl.get(url);
    if (!listing) {
      continue;
    }

    brPages += 1;
    throwIfAborted(ctx.signal);

    const rendered = await renderUrlToMarkdown(
      env,
      url,
      ctx.signal ? { signal: ctx.signal } : {}
    );
    if ("error" in rendered) {
      errors.push({
        source: "downtown-fresno-api",
        url,
        message: rendered.error,
        recoverable: true
      });
      await sleep(DOWNTOWN_DETAIL_DELAY_MS);
      continue;
    }

    try {
      const extracted = await extractEventsFromMarkdown(env, {
        url,
        label: "Downtown Fresno event detail",
        markdown: rendered.markdown,
        variant: "default"
      });

      const detail = extracted[0] ?? null;
      bySourceEventId.set(listing.sourceEventId, mergeListingWithDetail(listing, detail));

      if (!detail) {
        errors.push({
          source: "downtown-fresno-api",
          url,
          message: "LLM returned no events for detail page",
          recoverable: true
        });
      }
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") {
        throw error;
      }
      errors.push({
        source: "downtown-fresno-api",
        url,
        message: error instanceof Error ? error.message : "detail enrichment failed",
        recoverable: true
      });
    }

    await sleep(DOWNTOWN_DETAIL_DELAY_MS);
  }

  const deduped = dedupeBySourceEventId([...bySourceEventId.values()]);

  log({
    step: "run_end",
    eventsFound: deduped.length,
    listings: listings.length,
    brPages,
    errors: errors.length
  });

  return finish(ctx, started, deduped, errors, listings.length + brPages);
}

async function discoverListings(ctx: ScrapeContext, errors: ScrapeError[]): Promise<NormalizedEvent[]> {
  const events: NormalizedEvent[] = [];
  const windows = buildDowntownWindows(ctx.now);
  let pages = 0;

  for (const bbqparam of windows) {
    const url = buildDowntownFresnoUrl(bbqparam);
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

  return dedupeBySourceEventId(events);
}

function uniqueDetailUrls(listings: NormalizedEvent[]): string[] {
  const urls = new Set<string>();
  for (const event of listings) {
    const url = event.externalUrl?.trim();
    if (url?.startsWith("http")) {
      urls.add(url);
    }
  }
  return [...urls];
}

function dedupeBySourceEventId(events: NormalizedEvent[]): NormalizedEvent[] {
  const byKey = new Map<string, NormalizedEvent>();
  for (const event of events) {
    byKey.set(`${event.source}:${event.sourceEventId}`, event);
  }
  return [...byKey.values()];
}

function throwIfAborted(signal: AbortSignal | undefined) {
  if (signal?.aborted) {
    throw new DOMException("Ingest aborted", "AbortError");
  }
}

function sleep(ms: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms));
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
