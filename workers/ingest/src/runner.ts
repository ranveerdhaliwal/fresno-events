import type { CoordinatorMode, ScrapeContext, ScrapeResult } from "@fresno-events/shared";

import { runEnrichmentPipeline, type EnrichRecentCandidatesOptions, type EnrichmentSummary } from "@/enrichment";
import { persistScrapeResult, previewPersistScrapeResult, type PersistenceResult } from "@/candidates";
import { dedupeScrapeBatch } from "@/lib/scrape-batch-dedupe.utils";
import { applySeriesMetadata } from "@/lib/series-metadata.utils";
import type { PersistAuditItemBatchDuplicate, PersistAuditSummary } from "@/candidates/persist-audit.utils";
import { mergePersistAuditSummaries } from "@/candidates/persist-analysis.utils";
import type { IngestEnv } from "@/env";
import { listRunnableSources, planIngestRuns, sortPlanByStalest, type PlanItem } from "@/planner";
import { resolveScraperRun, findScraper } from "@/registry";
import { getSupabaseConfig } from "@/sources";
import {
  getProfileForScraper,
  validateScrapeResult,
  type ScrapeValidationResult
} from "@/validation";

export interface RunSummary {
  source: string;
  runId: string;
  events_found: number;
  errors: number;
  persistence: PersistenceResult;
  duration_ms: number;
  ok: boolean;
  /** Scraper already persisted and enriched per venue (venue-ingest). */
  enrichmentPerVenue?: boolean;
  message?: string;
  dry_run?: boolean;
  events?: Array<{
    title: string;
    venueName: string;
    startTs: string;
    sourceEventId: string;
    externalUrl?: string;
  }>;
  scrape_errors?: Array<{ url?: string; message: string }>;
  seed_metrics?: Array<{
    url: string;
    label?: string | null;
    events_found: number;
    venue_key?: string;
    event_source?: string;
    detail_urls_planned?: number;
    dry_run_plan?: boolean;
    listing_urls?: string[];
    detail_urls?: string[];
    event_links?: Array<{ title: string; url: string; start_ts?: string }>;
    strategy?: string;
    ingest_lane?: "direct" | "browser";
    detail_mode?: string;
    fetch_urls?: string[];
  }>;
  validation?: ScrapeValidationResult;
  persist_preview?: PersistAuditSummary;
  /** Scrape count before within-batch dedupe (when dedupe runs). */
  raw_events_found?: number;
  batch_duplicates_removed?: number;
  batch_duplicate_items?: PersistAuditItemBatchDuplicate[];
}

export interface RunOptions {
  /** One key, comma-separated keys, or `all`. */
  sources?: string;
  force?: boolean;
  dryRun?: boolean;
  resumeJobs?: boolean;
  /** Venue keys for venue-ingest (e.g. tower-theatre, save-mart). */
  venueFilter?: string[];
  /** When true, skip post-ingest AI enrichment (caller may run it via `waitUntil`). */
  skipEnrichment?: boolean;
  /** Propagates to scrapers (abort signal). */
  signal?: AbortSignal;
}

export async function runIngest(env: IngestEnv, options: RunOptions = {}): Promise<RunSummary[]> {
  const supabase = getSupabaseConfig(env);
  const userAgent = env.USER_AGENT ?? "WhatUpFresnoBot/0.1";
  const now = new Date();

  const planOpts: { sources?: string; force?: boolean } = {};
  if (options.sources) {
    planOpts.sources = options.sources;
  }
  if (options.force) {
    planOpts.force = true;
  }
  let planned = await planIngestRuns(env, planOpts);
  if (!options.sources && supabase) {
    planned = await sortPlanByStalest(planned, supabase);
  }

  if (planned.length === 0) {
    const hint = options.sources
      ? `No runnable source for "${options.sources}" (check API keys in .dev.vars).`
      : "No sources due or runnable. Use --source=ticketmaster or --all --force.";
    return [
      {
        source: options.sources ?? "none",
        runId: "skipped",
        events_found: 0,
        errors: 0,
        persistence: { persisted: false, reason: hint },
        duration_ms: 0,
        ok: true,
        message: hint
      }
    ];
  }

  const maxSources = parsePositiveInt(env.MAX_SOURCES_PER_RUN, 8);
  const cappedPlan = planned.slice(0, maxSources);
  const summaries: RunSummary[] = [];

  console.log(
    JSON.stringify({
      event: "ingest_batch_start",
      sources: cappedPlan.map((p) => p.key),
      sourceTotal: cappedPlan.length,
      plannedTotal: planned.length,
      ...(planned.length > cappedPlan.length ? { truncated: planned.length - cappedPlan.length } : {}),
      dry_run: options.dryRun ?? false
    })
  );

  const runCtx: RunOneContext = { now, userAgent, supabase };
  if (options.dryRun) {
    runCtx.dryRun = true;
  }
  if (options.resumeJobs) {
    runCtx.resumeJobs = true;
  }
  if (options.signal) {
    runCtx.signal = options.signal;
  }
  if (options.venueFilter?.length) {
    runCtx.venueFilter = options.venueFilter;
  }

  for (let i = 0; i < cappedPlan.length; i += 1) {
    const plan = cappedPlan[i];
    if (!plan) {
      continue;
    }
    summaries.push(await runOne(env, plan, runCtx, { sourceIndex: i + 1, sourceTotal: cappedPlan.length }));
  }

  if (planned.length > cappedPlan.length) {
    console.log(JSON.stringify({
      event: "source_budget_exceeded",
      planned: planned.length,
      executed: cappedPlan.length,
      max_sources_per_run: maxSources
    }));
  }

  if (options.dryRun) {
    const previews = summaries
      .map((summary) => summary.persist_preview)
      .filter((preview): preview is PersistAuditSummary => preview !== undefined);
    const mergedPreview = previews.length > 0 ? mergePersistAuditSummaries(previews) : null;

    console.log(
      JSON.stringify({
        event: "ingest_fetch_phase_done",
        message: "Dry run — no DB writes or enrichment",
        sources: summaries.map((s) => ({
          source: s.source,
          events_found: s.events_found,
          ok: s.ok,
          validation_ok: s.validation?.ok ?? null,
          ...(s.persist_preview
            ? {
                preview: {
                  new: s.persist_preview.new,
                  changed: s.persist_preview.changed,
                  unchanged: s.persist_preview.unchanged
                }
              }
            : {})
        })),
        total_events_found: summaries.reduce((n, s) => n + s.events_found, 0),
        ...(mergedPreview
          ? {
              persist_preview: {
                new: mergedPreview.new,
                changed: mergedPreview.changed,
                unchanged: mergedPreview.unchanged,
                new_items: mergedPreview.new_items,
                changed_items: mergedPreview.changed_items,
                ...(mergedPreview.batch_duplicates
                  ? {
                      batch_duplicates: mergedPreview.batch_duplicates,
                      batch_duplicate_items: mergedPreview.batch_duplicate_items
                    }
                  : {})
              }
            }
          : {}),
        batch_duplicates_removed: summaries.reduce(
          (n, s) => n + (s.batch_duplicates_removed ?? 0),
          0
        ),
        batch_duplicate_items: summaries.flatMap((s) => s.batch_duplicate_items ?? [])
      })
    );

    if (mergedPreview) {
      const batchRemoved = summaries.reduce((n, s) => n + (s.batch_duplicates_removed ?? 0), 0);
      console.log(
        JSON.stringify({
          event: "ingest_preflight_summary",
          dry_run: true,
          new: mergedPreview.new,
          changed: mergedPreview.changed,
          unchanged: mergedPreview.unchanged,
          new_items: mergedPreview.new_items,
          changed_items: mergedPreview.changed_items,
          ...(mergedPreview.batch_duplicates
            ? {
                batch_duplicates: mergedPreview.batch_duplicates,
                batch_duplicate_items: mergedPreview.batch_duplicate_items
              }
            : {}),
          ...(batchRemoved > 0 ? { batch_duplicates_removed: batchRemoved } : {})
        })
      );
      const batchNote =
        batchRemoved > 0 ? `, −${batchRemoved} batch duplicate(s) removed` : "";
      console.log(
        `[ingest] preflight preview: +${mergedPreview.new} new, ~${mergedPreview.changed} changed, =${mergedPreview.unchanged} unchanged${batchNote} (no DB writes).`
      );
    } else {
      console.log("[ingest] preflight preview skipped (no Supabase config or zero events).");
    }

    console.log("[ingest] Fetch phase complete (dry run).");
    return summaries;
  }

  const totalEvents = summaries.reduce((n, s) => n + s.events_found, 0);
  const totalCandidates = summaries.reduce(
    (n, s) => n + (s.persistence.persisted === true ? s.persistence.candidates : 0),
    0
  );

  console.log(
    JSON.stringify({
      event: "ingest_fetch_phase_done",
      message: "All scraper fetches finished",
      sources: summaries.map((s) => ({
        source: s.source,
        events_found: s.events_found,
        candidates: s.persistence.persisted === true ? s.persistence.candidates : 0,
        ok: s.ok
      })),
      total_events_found: totalEvents,
      total_candidates_persisted: totalCandidates
    })
  );
  console.log(
    `[ingest] Fetch phase complete (${summaries.length} sources, ${totalEvents} events, ${totalCandidates} candidates persisted).`
  );

  const enrichmentPerVenue = summaries.some((s) => s.enrichmentPerVenue);
  if (!options.skipEnrichment && !enrichmentPerVenue) {
    await runPostIngestEnrichment(env);
  } else if (enrichmentPerVenue) {
    console.log("[ingest] Skipping global enrichment (already ran per venue in venue-ingest).");
  } else {
    console.log("[ingest] Skipping AI enrichment (--no-enrich).");
  }

  console.log(
    JSON.stringify({
      event: "ingest_run_complete",
      message: "Ingest run finished",
      sources: summaries.length,
      skip_enrichment: options.skipEnrichment ?? false
    })
  );
  console.log("[ingest] Run complete.");

  return summaries;
}

export async function runPostIngestEnrichment(
  env: IngestEnv,
  options: EnrichRecentCandidatesOptions = {}
): Promise<EnrichmentSummary | null> {
  const supabase = getSupabaseConfig(env);
  if (!supabase) {
    return null;
  }

  try {
    return await runEnrichmentPipeline(env, supabase, {
      enrichAll: options.enrichAll ?? options.limit === undefined,
      ...options
    });
  } catch (error) {
    console.log(JSON.stringify({ event: "ai_enrichment_failed", message: errorMessage(error) }));
    console.log(`[ingest] AI enrichment failed: ${errorMessage(error)}`);
    return null;
  }
}

function parsePositiveInt(value: string | undefined, fallback: number) {
  if (!value) return fallback;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? Math.trunc(parsed) : fallback;
}

interface RunOneContext {
  now: Date;
  userAgent: string;
  supabase: ReturnType<typeof getSupabaseConfig>;
  dryRun?: boolean;
  resumeJobs?: boolean;
  venueFilter?: string[];
  signal?: AbortSignal;
}

function resolveCoordinatorMode(ctx: RunOneContext): CoordinatorMode {
  if (ctx.dryRun) {
    return "dry-run";
  }
  if (ctx.resumeJobs) {
    return "resume-jobs";
  }
  return "real";
}

async function runOne(
  env: IngestEnv,
  plan: PlanItem,
  ctx: RunOneContext,
  batch: { sourceIndex: number; sourceTotal: number }
): Promise<RunSummary> {
  const scraper = findScraper(plan.key);

  if (!scraper) {
    return {
      source: plan.key,
      runId: "missing",
      events_found: 0,
      errors: 1,
      persistence: { persisted: false, reason: "No registered scraper for this key." },
      duration_ms: 0,
      ok: false,
      message: `No registered scraper for ${plan.key}.`
    };
  }

  const runId = crypto.randomUUID();
  const started = performance.now();

  console.log(
    JSON.stringify({
      event: "ingest_source_start",
      source: plan.key,
      runId,
      sourceIndex: batch.sourceIndex,
      sourceTotal: batch.sourceTotal,
      dry_run: ctx.dryRun ?? false,
      resume_jobs: ctx.resumeJobs ?? false
    })
  );

  const scrapeConfig: Record<string, unknown> = { ...plan.config };
  if (ctx.venueFilter?.length && plan.key === "venue-ingest") {
    scrapeConfig.venues = ctx.venueFilter;
  }

  const scrapeContext: ScrapeContext = {
    runId,
    now: ctx.now,
    userAgent: ctx.userAgent,
    secrets: extractSecrets(env, scraper.requiredSecrets ?? []),
    config: scrapeConfig,
    coordinatorMode: resolveCoordinatorMode(ctx),
    ...(ctx.signal ? { signal: ctx.signal } : {})
  };

  let result: ScrapeResult;
  const runHandler = resolveScraperRun(scraper, env);

  try {
    result = await runHandler(scrapeContext);
  } catch (error) {
    const message = errorMessage(error);
    return {
      source: plan.key,
      runId,
      events_found: 0,
      errors: 1,
      persistence: { persisted: false, reason: message },
      duration_ms: Math.round(performance.now() - started),
      ok: false,
      message,
      ...(ctx.dryRun ? { dry_run: true } : {})
    };
  }

  const rawEventCount = result.events.length;
  const batchDedupe = await dedupeScrapeBatch(result.events);
  result.events = batchDedupe.events;
  const batchDedupeFields =
    batchDedupe.removed > 0
      ? {
          raw_events_found: rawEventCount,
          batch_duplicates_removed: batchDedupe.removed,
          batch_duplicate_items: batchDedupe.duplicates
        }
      : {};
  if (batchDedupe.removed > 0) {
    console.log(
      JSON.stringify({
        event: "ingest_batch_duplicates",
        source: plan.key,
        runId,
        raw_events: rawEventCount,
        kept_events: result.events.length,
        removed: batchDedupe.removed,
        items: batchDedupe.duplicates
      })
    );
    console.log(
      `[ingest] ${plan.key}: removed ${batchDedupe.removed} within-batch duplicate(s) (${rawEventCount} → ${result.events.length})`
    );
  }

  result.events = await applySeriesMetadata(result.events);

  const validation = runScrapeValidation(env, plan.key, result, ctx);

  if (ctx.dryRun) {
    let persistPreview =
      validation.ok && ctx.supabase && result.events.length > 0
        ? (await previewPersistScrapeResult(env, result)) ?? undefined
        : undefined;

    if (persistPreview && batchDedupe.removed > 0) {
      persistPreview = {
        ...persistPreview,
        batch_duplicates: batchDedupe.removed,
        batch_duplicate_items: batchDedupe.duplicates
      };
    }

    if (persistPreview) {
      console.log(
        JSON.stringify({
          event: "ingest_preflight_persist_summary",
          source: plan.key,
          runId,
          dry_run: true,
          new: persistPreview.new,
          changed: persistPreview.changed,
          unchanged: persistPreview.unchanged,
          new_items: persistPreview.new_items,
          changed_items: persistPreview.changed_items
        })
      );
      console.log(
        `[ingest] preflight ${plan.key}: +${persistPreview.new} new, ~${persistPreview.changed} changed, =${persistPreview.unchanged} unchanged`
      );
    }

    return {
      source: plan.key,
      runId,
      events_found: result.events.length,
      errors: result.errors.length,
      persistence: {
        persisted: false,
        reason:
          plan.key === "venue-ingest"
            ? "Dry run — no candidates; venue_ingest_runs updated for debug."
            : "Dry run — no database writes."
      },
      duration_ms: Math.round(performance.now() - started),
      ok: validation.ok,
      validation,
      dry_run: true,
      ...(persistPreview ? { persist_preview: persistPreview } : {}),
      ...batchDedupeFields,
      scrape_errors: result.errors.map((err) => ({
        ...(err.url ? { url: err.url } : {}),
        message: err.message
      })),
      ...(result.seedMetrics?.length ? { seed_metrics: mapSeedMetrics(result) } : {})
    };
  }

  if (!validation.ok) {
    console.log(
      JSON.stringify({
        event: "ingest_validation_failed",
        source: plan.key,
        runId,
        hard: validation.hard,
        soft: validation.soft
      })
    );
    return {
      source: plan.key,
      runId,
      events_found: result.events.length,
      errors: result.errors.length,
      persistence: { persisted: false, reason: "Validation failed — no candidates written." },
      duration_ms: Math.round(performance.now() - started),
      ok: false,
      message: validation.hard.map((i) => i.message).join("; "),
      validation,
      scrape_errors: result.errors.map((err) => ({
        ...(err.url ? { url: err.url } : {}),
        message: err.message
      })),
      ...(result.seedMetrics?.length ? { seed_metrics: mapSeedMetrics(result) } : {}),
      ...batchDedupeFields
    };
  }

  const enrichmentPerVenue = result.metrics.venuePersistPerVenue === true;
  const persistence: PersistenceResult = enrichmentPerVenue
    ? { persisted: true, candidates: result.events.length }
    : await persistScrapeResult(env, result);
  console.log(
    JSON.stringify({
      event: "ingest_source_end",
      source: plan.key,
      runId,
      sourceIndex: batch.sourceIndex,
      sourceTotal: batch.sourceTotal,
      events_found: result.events.length,
      errors: result.errors.length,
      persistence,
      enrichment_per_venue: enrichmentPerVenue,
      duration_ms: Math.round(performance.now() - started)
    })
  );

  return {
    source: plan.key,
    runId,
    events_found: result.events.length,
    errors: result.errors.length,
    persistence,
    duration_ms: Math.round(performance.now() - started),
    ok: true,
    enrichmentPerVenue,
    validation,
    scrape_errors: result.errors.map((err) => ({
      ...(err.url ? { url: err.url } : {}),
      message: err.message
    })),
    ...(result.seedMetrics?.length ? { seed_metrics: mapSeedMetrics(result) } : {}),
    ...batchDedupeFields
  };
}

function mapSeedMetrics(result: ScrapeResult): NonNullable<RunSummary["seed_metrics"]> {
  return (result.seedMetrics ?? []).map((metric) => ({
    url: metric.url,
    ...(metric.label ? { label: metric.label } : {}),
    events_found: metric.eventsFound,
    ...(metric.venueKey ? { venue_key: metric.venueKey } : {}),
    ...(metric.eventSource ? { event_source: metric.eventSource } : {}),
    ...(typeof metric.detailUrlsPlanned === "number" ? { detail_urls_planned: metric.detailUrlsPlanned } : {}),
    ...(metric.dryRunPlan ? { dry_run_plan: true } : {}),
    ...(metric.listingUrls?.length ? { listing_urls: metric.listingUrls } : {}),
    ...(metric.detailUrls?.length ? { detail_urls: metric.detailUrls } : {}),
    ...(metric.eventLinks?.length
      ? {
          event_links: metric.eventLinks.map((link) => ({
            title: link.title,
            url: link.url,
            ...(link.startTs ? { start_ts: link.startTs } : {})
          }))
        }
      : {}),
    ...(metric.strategy ? { strategy: metric.strategy } : {}),
    ...(metric.ingestLane ? { ingest_lane: metric.ingestLane } : {}),
    ...(metric.detailMode ? { detail_mode: metric.detailMode } : {}),
    ...(metric.fetchUrls?.length ? { fetch_urls: metric.fetchUrls } : {})
  }));
}

function runScrapeValidation(
  env: IngestEnv,
  scraperKey: string,
  result: ScrapeResult,
  ctx: Pick<RunOneContext, "venueFilter">
): ScrapeValidationResult {
  if (env.INGEST_SKIP_VALIDATION === "true") {
    console.log(JSON.stringify({ event: "ingest_validation_skipped", source: scraperKey }));
    return { ok: true, hard: [], soft: [] };
  }

  const profile = getProfileForScraper(scraperKey);
  const validation = validateScrapeResult(result, profile, {
    ...(ctx.venueFilter?.length ? { venueFilter: ctx.venueFilter } : {})
  });

  if (validation.soft.length > 0) {
    console.log(
      JSON.stringify({
        event: "ingest_validation_warn",
        source: scraperKey,
        soft: validation.soft
      })
    );
  }

  return validation;
}

function extractSecrets(env: IngestEnv, keys: ReadonlyArray<keyof IngestEnv>) {
  const secrets: Record<string, string | undefined> = {};
  for (const key of keys) {
    const value = env[key];
    if (typeof value === "string") {
      secrets[key as string] = value;
    }
  }
  return secrets;
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

export const allRegisteredSources = listRunnableSources;
