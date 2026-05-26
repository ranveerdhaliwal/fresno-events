import type { ScrapeContext, ScrapeError, ScrapeResult } from "@fresno-events/shared";

import type { IngestEnv } from "@/env";
import { ensureIngestRunStarted, finishIngestRunRecord } from "@/ingest-runs";
import { finishVenueRun, startVenueRun, type VenueRunStatus } from "@/venue-ingest-state";
import { loadEnabledVenues, runVenue } from "@/venues/registry";

function parseVenueFilter(config: Record<string, unknown>): string[] | undefined {
  const raw = config.venues;
  if (typeof raw === "string" && raw.trim()) {
    return raw
      .split(",")
      .map((part) => part.trim())
      .filter(Boolean);
  }
  if (Array.isArray(raw)) {
    return raw.filter((v): v is string => typeof v === "string" && v.trim().length > 0);
  }
  return undefined;
}

function venueRunStatus(errors: ScrapeError[], eventsFound: number): VenueRunStatus {
  if (errors.length > 0 && eventsFound === 0) {
    return "failed";
  }
  if (errors.length > 0) {
    return "completed_with_errors";
  }
  return "completed";
}

export function createVenueIngestRunner(env: IngestEnv) {
  return async (ctx: ScrapeContext): Promise<ScrapeResult> => {
    const started = performance.now();
    const dryRun = ctx.coordinatorMode === "dry-run";
    const venueFilter = parseVenueFilter(ctx.config);
    const venues = loadEnabledVenues(venueFilter);
    const errors: ScrapeError[] = [];
    const allEvents: ScrapeResult["events"] = [];
    const seedMetrics: NonNullable<ScrapeResult["seedMetrics"]> = [];
    let pagesVisited = 0;

    console.log(
      JSON.stringify({
        event: "venue_ingest_scraper_start",
        dry_run: dryRun,
        venue_count: venues.length,
        venues: venues.map((v) => v.key),
        ...(venueFilter ? { venue_filter: venueFilter } : {})
      })
    );

    if (venues.length === 0) {
      return result(
        ctx,
        [],
        [
          {
            source: "venue-ingest",
            message: venueFilter?.length
              ? `No enabled venues match filter: ${venueFilter.join(", ")}`
              : "No enabled venues in registry.",
            recoverable: true
          }
        ],
        0,
        started,
        []
      );
    }

    try {
      await ensureIngestRunStarted(env, {
        runId: ctx.runId,
        source: "venue-ingest",
        dryRun
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return result(
        ctx,
        [],
        [{ source: "venue-ingest", message, recoverable: false }],
        0,
        started,
        []
      );
    }

    for (const config of venues) {
      let venueRunId: string | null = null;
      try {
        venueRunId = await startVenueRun(env, config.key, ctx.runId, dryRun);
        const venueResult = await runVenue(env, config, {
          ingestRunId: ctx.runId,
          dryRun,
          userAgent: ctx.userAgent,
          ...(ctx.signal ? { signal: ctx.signal } : {}),
          ...(venueFilter ? { venueFilter } : {})
        });

        pagesVisited += venueResult.listingUrlsFound + venueResult.detailUrlsVisited;
        allEvents.push(...venueResult.events);
        errors.push(...venueResult.errors);

        const status: VenueRunStatus = dryRun
          ? "dry_run"
          : venueRunStatus(venueResult.errors, venueResult.events.length);

        await finishVenueRun(env, {
          venueRunId,
          venueKey: config.key,
          ingestRunId: ctx.runId,
          status,
          eventsFound: venueResult.events.length,
          listingUrlsFound: venueResult.listingUrlsFound,
          detailUrlsVisited: venueResult.detailUrlsVisited,
          debug: venueResult.debug,
          brCrawlJobId: venueResult.brCrawlJobId ?? null,
          brCrawlStatus: venueResult.brCrawlStatus ?? null
        });

        seedMetrics.push({
          url: config.listingUrl,
          label: config.label,
          eventsFound: venueResult.events.length,
          venueKey: config.key
        });

        console.log(
          JSON.stringify({
            event: "venue_ingest_venue_done",
            venue_key: config.key,
            events_found: venueResult.events.length,
            detail_urls_visited: venueResult.detailUrlsVisited,
            llm_calls: venueResult.llmCalls,
            status
          })
        );
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        errors.push({
          source: `venue-ingest:${config.key}`,
          message,
          recoverable: false
        });

        if (venueRunId) {
          await finishVenueRun(env, {
            venueRunId,
            venueKey: config.key,
            ingestRunId: ctx.runId,
            status: dryRun ? "dry_run" : "failed",
            eventsFound: 0,
            listingUrlsFound: 0,
            detailUrlsVisited: 0,
            debug: { errors: [message] }
          }).catch(() => undefined);
        }
      }
    }

    const scrapeResult = result(ctx, allEvents, errors, pagesVisited, started, seedMetrics);

    if (dryRun) {
      try {
        await finishIngestRunRecord(env, {
          runId: ctx.runId,
          source: "venue-ingest",
          eventsFound: scrapeResult.events.length,
          errorsCount: scrapeResult.errors.length,
          metrics: {
            ...scrapeResult.metrics,
            venue_summary: seedMetrics.map((m) => ({
              venue_key: m.venueKey,
              events_found: m.eventsFound,
              url: m.url
            }))
          },
          dryRun: true
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        scrapeResult.errors.push({
          source: "venue-ingest",
          message,
          recoverable: false
        });
      }
    }

    console.log(
      JSON.stringify({
        event: "venue_ingest_scraper_end",
        events_found: scrapeResult.events.length,
        errors: scrapeResult.errors.length,
        duration_ms: scrapeResult.metrics.durationMs
      })
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
  seedMetrics: NonNullable<ScrapeResult["seedMetrics"]>
): ScrapeResult {
  return {
    source: "venue-ingest",
    runId: ctx.runId,
    events,
    errors,
    metrics: { pagesVisited, durationMs: Math.round(performance.now() - started) },
    seedMetrics
  };
}
