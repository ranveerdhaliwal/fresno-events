import type { NormalizedEvent, ScrapeContext, ScrapeError, ScrapeResult } from "@fresno-events/shared";

import type { IngestEnv } from "@/env";
import { loadEnabledSeedUrls, type SeedUrlRow } from "@/seed-urls";

import { parseGobulldogs } from "./seed-special-url/gobulldogs";

type SpecialUrlHandler = (seed: SeedUrlRow, ctx: ScrapeContext) => Promise<NormalizedEvent[]>;

export function createSpecialUrlRunner(env: IngestEnv) {
  return async (ctx: ScrapeContext): Promise<ScrapeResult> => {
    const started = performance.now();
    console.log(JSON.stringify({ event: "seed_special_url", step: "run_start" }));

    const seeds = await loadEnabledSeedUrls(env, { lane: "special_url" });
    console.log(JSON.stringify({ event: "seed_special_url", step: "seeds_loaded", count: seeds.length }));
    const events: NormalizedEvent[] = [];
    const errors: ScrapeError[] = [];

    const seedMetrics: ScrapeResult["seedMetrics"] = [];

    for (const seed of seeds) {
      try {
        const handler = pickHandler(seed.url);
        const seedEvents = await handler(seed, ctx);
        events.push(...seedEvents);
        seedMetrics.push({ url: seed.url, label: seed.label, eventsFound: seedEvents.length });
      } catch (error) {
        errors.push({
          source: "seed-special-url",
          url: seed.url,
          message: error instanceof Error ? error.message : String(error),
          recoverable: true
        });
        seedMetrics.push({ url: seed.url, label: seed.label, eventsFound: 0 });
      }
    }

    console.log(
      JSON.stringify({
        event: "seed_special_url",
        step: "run_end",
        seeds: seeds.length,
        eventsFound: events.length,
        errors: errors.length
      })
    );

    return {
      source: "seed-special-url",
      runId: ctx.runId,
      events,
      errors,
      metrics: {
        pagesVisited: seeds.length,
        durationMs: Math.round(performance.now() - started)
      },
      ...(seedMetrics.length > 0 ? { seedMetrics } : {})
    };
  };
}

function pickHandler(url: string): SpecialUrlHandler {
  if (url.includes("gobulldogs.com")) {
    return parseGobulldogs;
  }

  throw new Error(`No special-url handler for ${url}`);
}
