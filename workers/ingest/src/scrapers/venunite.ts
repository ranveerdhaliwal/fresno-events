import type { NormalizedEvent, ScrapeContext, ScrapeError, ScrapeResult } from "@fresno-events/shared";

import {
  buildVenunitePageUrl,
  mapVenuniteEvents,
  parseVenuniteResponse,
  sleep,
  venuniteConfig
} from "./venunite.utils";

export async function run(ctx: ScrapeContext): Promise<ScrapeResult> {
  const started = performance.now();
  const errors: ScrapeError[] = [];
  const allEvents: NormalizedEvent[] = [];
  let pagesVisited = 0;
  let totalPages = 1;

  try {
    for (let page = 1; page <= totalPages; page++) {
      if (ctx.signal?.aborted) {
        throw new DOMException("Aborted", "AbortError");
      }

      const url = buildVenunitePageUrl(page);
      const response = await fetch(url, {
        headers: {
          Accept: "application/json",
          "User-Agent": ctx.userAgent
        },
        ...(ctx.signal ? { signal: ctx.signal } : {})
      });

      pagesVisited += 1;

      if (!response.ok) {
        errors.push({
          source: "venunite",
          url,
          message: `VenuNite responded with ${response.status}.`,
          recoverable: response.status >= 500 || response.status === 429
        });
        break;
      }

      const payload = parseVenuniteResponse(await response.json());
      totalPages = payload.totalPages;
      allEvents.push(...mapVenuniteEvents(payload.events));

      if (page < totalPages) {
        await sleep(venuniteConfig.pageDelayMs);
      }
    }
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      throw error;
    }
    errors.push({
      source: "venunite",
      message: error instanceof Error ? error.message : "VenuNite ingest failed.",
      recoverable: true
    });
  }

  return {
    source: "venunite",
    runId: ctx.runId,
    events: allEvents,
    errors,
    metrics: {
      pagesVisited,
      durationMs: Math.round(performance.now() - started)
    }
  };
}
