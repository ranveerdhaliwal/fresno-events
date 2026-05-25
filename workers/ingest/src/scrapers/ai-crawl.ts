import type { CoordinatorMode, ScrapeContext, ScrapeError, ScrapeResult } from "@fresno-events/shared";

import type { IngestEnv } from "@/env";
import { runCoordinator } from "@/coordinator";
import { loadEnabledSeedUrls } from "@/seed-urls";

export function createAiCrawlRunner(env: IngestEnv) {
  return async (ctx: ScrapeContext): Promise<ScrapeResult> => {
    const started = performance.now();

    if (!env.CLOUDFLARE_ACCOUNT_ID || !env.CLOUDFLARE_API_TOKEN) {
      return result(
        ctx,
        [],
        [{ source: "ai-crawl", message: "BR credentials missing (CLOUDFLARE_ACCOUNT_ID, CLOUDFLARE_API_TOKEN).", recoverable: true }],
        0,
        started
      );
    }

    const mode: CoordinatorMode = ctx.coordinatorMode ?? "real";
    const seeds = await loadEnabledSeedUrls(env, { lane: "crawl" });

    console.log(
      JSON.stringify({
        event: "ai_crawl_scraper_start",
        mode,
        seed_count: seeds.length,
        dry_run: mode === "dry-run"
      })
    );
    console.log(`[ingest] ai-crawl starting (${seeds.length} seeds, mode=${mode}).`);

    if (seeds.length === 0) {
      return result(
        ctx,
        [],
        [{ source: "ai-crawl", message: "No enabled rows in seed_urls.", recoverable: true }],
        0,
        started,
        []
      );
    }

    const coordinatorOpts = ctx.signal ? { abortSignal: ctx.signal } : {};
    const { events, errors, metrics, seedMetrics } = await runCoordinator(env, seeds, mode, coordinatorOpts);

    const scrapeResult = result(ctx, events, errors, metrics.pagesVisited, started, seedMetrics);

    console.log(
      JSON.stringify({
        event: "ai_crawl_scraper_end",
        mode,
        events_found: scrapeResult.events.length,
        errors: scrapeResult.errors.length,
        pages_visited: metrics.pagesVisited,
        llm_calls: metrics.llmCalls,
        duration_ms: scrapeResult.metrics.durationMs,
        seed_metrics: seedMetrics
      })
    );
    console.log(
      `[ingest] ai-crawl finished (${scrapeResult.events.length} events, ${metrics.pagesVisited} pages, ${Math.round(scrapeResult.metrics.durationMs / 1000)}s).`
    );

    return scrapeResult;
  };
}

function result(
  ctx: ScrapeContext,
  events: ScrapeResult["events"],
  errors: ScrapeError[],
  pagesVisited: number,
  started: number,
  seedMetrics: ScrapeResult["seedMetrics"] = []
): ScrapeResult {
  return {
    source: "ai-crawl",
    runId: ctx.runId,
    events,
    errors,
    metrics: { pagesVisited, durationMs: Math.round(performance.now() - started) },
    ...(seedMetrics.length > 0 ? { seedMetrics } : {})
  };
}
