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

    return result(ctx, events, errors, metrics.pagesVisited, started, seedMetrics);
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
