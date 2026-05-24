import type { CoordinatorMode, ScrapeContext, ScrapeResult } from "@fresno-events/shared";

import { enrichRecentCandidates, type EnrichRecentCandidatesOptions, type EnrichmentSummary } from "@/enrichment";
import { persistScrapeResult, type PersistenceResult } from "@/candidates";
import type { IngestEnv } from "@/env";
import { listRunnableSources, planIngestRuns, type PlanItem } from "@/planner";
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
  seed_metrics?: Array<{ url: string; label?: string | null; events_found: number }>;
  validation?: ScrapeValidationResult;
}

export interface RunOptions {
  /** One key, comma-separated keys, or `all`. */
  sources?: string;
  force?: boolean;
  dryRun?: boolean;
  resumeJobs?: boolean;
  /** When true, skip post-ingest AI enrichment (caller may run it via `waitUntil`). */
  skipEnrichment?: boolean;
  /** Propagates to scrapers; ai-crawl cancels in-flight Browser Rendering jobs on abort. */
  signal?: AbortSignal;
}

const DRY_RUN_EVENT_PREVIEW_LIMIT = 25;

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
  const planned = await planIngestRuns(env, planOpts);

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
    return summaries;
  }

  if (!options.skipEnrichment) {
    await runPostIngestEnrichment(env);
  }

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

  console.log(JSON.stringify({ event: "ai_enrichment_run_start", dry_run: options.dryRun ?? false }));

  try {
    const limit = options.limit ?? parsePositiveInt(env.MAX_ENRICH_PER_RUN, 25);
    const enriched = await enrichRecentCandidates(env, supabase, limit, options);
    if (enriched.processed > 0) {
      console.log(JSON.stringify({ event: "ai_enrichment", ...enriched }));
    }
    console.log(JSON.stringify({ event: "ai_enrichment_run_end", ...enriched }));
    return enriched;
  } catch (error) {
    console.log(JSON.stringify({ event: "ai_enrichment_failed", message: errorMessage(error) }));
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

  const scrapeContext: ScrapeContext = {
    runId,
    now: ctx.now,
    userAgent: ctx.userAgent,
    secrets: extractSecrets(env, scraper.requiredSecrets ?? []),
    config: plan.config,
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

  const validation = runScrapeValidation(env, plan.key, result);

  if (ctx.dryRun) {
    return {
      source: plan.key,
      runId,
      events_found: result.events.length,
      errors: result.errors.length,
      persistence: { persisted: false, reason: "Dry run — no database writes." },
      duration_ms: Math.round(performance.now() - started),
      ok: validation.ok,
      validation,
      dry_run: true,
      events: result.events.slice(0, DRY_RUN_EVENT_PREVIEW_LIMIT).map((event) => ({
        title: event.title,
        venueName: event.venueName,
        startTs: event.startTs,
        sourceEventId: event.sourceEventId,
        ...(event.externalUrl ? { externalUrl: event.externalUrl } : {})
      })),
      scrape_errors: result.errors.map((err) => ({
        ...(err.url ? { url: err.url } : {}),
        message: err.message
      })),
      ...(result.seedMetrics?.length
        ? {
            seed_metrics: result.seedMetrics.map((metric) => ({
              url: metric.url,
              ...(metric.label ? { label: metric.label } : {}),
              events_found: metric.eventsFound
            }))
          }
        : {})
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
      validation
    };
  }

  const persistence = await persistScrapeResult(env, result);
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
    validation
  };
}

function runScrapeValidation(
  env: IngestEnv,
  scraperKey: string,
  result: ScrapeResult
): ScrapeValidationResult {
  if (env.INGEST_SKIP_VALIDATION === "true") {
    console.log(JSON.stringify({ event: "ingest_validation_skipped", source: scraperKey }));
    return { ok: true, hard: [], soft: [] };
  }

  const profile = getProfileForScraper(scraperKey);
  const validation = validateScrapeResult(result, profile);

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
