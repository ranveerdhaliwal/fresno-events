import type { NormalizedEvent, ScrapeResult } from "@fresno-events/shared";

import { persistScrapeResult, type PersistenceResult, type PersistAuditSummary } from "@/candidates";
import type { IngestEnv } from "@/env";
import { runEventbriteDetailBackfill } from "@/eventbrite-detail-backfill";
import { runTicketSiteDetailBackfill } from "@/ticket-site-detail-backfill";
import { runPostIngestEnrichment } from "@/runner";
import type { EnrichmentSummary } from "@/enrichment";
import { applySeriesMetadata } from "@/lib/series-metadata.utils";

export interface PersistAndEnrichVenueResult {
  persistence: PersistenceResult;
  sourceFilter: string;
  enrichment: EnrichmentSummary | null;
  audit: PersistAuditSummary | null;
  /** Events after series metadata (same array persisted). */
  events: NormalizedEvent[];
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
      sourceFilter,
      enrichment: null,
      audit: null,
      events: []
    };
  }

  const eventsWithSeries = await applySeriesMetadata(events);

  const scrapeResult: ScrapeResult = {
    source: "venue-ingest",
    runId,
    events: eventsWithSeries,
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

  const eventbriteLimit = Math.min(Math.max(events.length, 5), 20);
  const eventbriteSummary = await runEventbriteDetailBackfill(env, {
    sourceFilter,
    limit: eventbriteLimit
  });
  console.log(
    JSON.stringify({
      event: "venue_ingest_eventbrite_detail_done",
      source_filter: sourceFilter,
      ...eventbriteSummary
    })
  );

  const ticketSiteLimit = Math.min(Math.max(events.length, 5), 20);
  const ticketSiteSummary = await runTicketSiteDetailBackfill(env, {
    sourceFilter,
    limit: ticketSiteLimit
  });
  console.log(
    JSON.stringify({
      event: "venue_ingest_ticket_site_detail_done",
      source_filter: sourceFilter,
      ...ticketSiteSummary
    })
  );

  const enrichLimit = Math.min(Math.max(events.length * 2, 25), 200);
  const enrichment = await runPostIngestEnrichment(env, { sourceFilter, limit: enrichLimit, enrichAll: true });

  console.log(
    JSON.stringify({
      event: "venue_ingest_enrich_done",
      source_filter: sourceFilter,
      events: events.length,
      ...(enrichment
        ? {
            enriched: enrichment.updated,
            skipped_sufficient: enrichment.skipped_sufficient_data,
            skipped_pending_detail: enrichment.skipped_pending_detail,
            errors: enrichment.errors
          }
        : {})
    })
  );

  return {
    persistence,
    sourceFilter,
    enrichment,
    audit: persistence.persisted ? (persistence.audit ?? null) : null,
    events: eventsWithSeries
  };
}
