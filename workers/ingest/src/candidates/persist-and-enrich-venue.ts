import type { NormalizedEvent, ScrapeResult } from "@fresno-events/shared";

import { persistScrapeResult, type PersistenceResult } from "@/candidates";
import type { IngestEnv } from "@/env";
import { runPostIngestEnrichment } from "@/runner";

export interface PersistAndEnrichVenueResult {
  persistence: PersistenceResult;
  sourceFilter: string;
}

/**
 * Persist one venue's events, run scoped AI enrichment, then promote rows to pending_review.
 */
export async function persistAndEnrichVenueEvents(
  env: IngestEnv,
  runId: string,
  events: NormalizedEvent[],
  sourceFilter: string
): Promise<PersistAndEnrichVenueResult> {
  if (events.length === 0) {
    return {
      persistence: { persisted: false, reason: "No events to persist for venue." },
      sourceFilter
    };
  }

  const scrapeResult: ScrapeResult = {
    source: "venue-ingest",
    runId,
    events,
    errors: [],
    metrics: {
      pagesVisited: 0,
      durationMs: 0,
      venuePersistPerVenue: true
    }
  };

  const persistence = await persistScrapeResult(env, scrapeResult);

  console.log(
    JSON.stringify({
      event: "venue_ingest_persist_done",
      source_filter: sourceFilter,
      events: events.length,
      persistence
    })
  );

  const enrichLimit = Math.min(Math.max(events.length * 2, 25), 200);
  await runPostIngestEnrichment(env, { sourceFilter, limit: enrichLimit, enrichAll: true });

  console.log(
    JSON.stringify({
      event: "venue_ingest_enrich_done",
      source_filter: sourceFilter,
      events: events.length
    })
  );

  return { persistence, sourceFilter };
}
