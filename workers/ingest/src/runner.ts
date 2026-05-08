import type { ScrapeContext, ScrapeResult } from "@fresno-events/shared";

import { enrichRecentCandidates } from "@/enrichment";
import { persistScrapeResult, type PersistenceResult } from "@/candidates";
import type { IngestEnv } from "@/env";
import { findScraper, resolveScraperRun, scrapers } from "@/registry";
import { getSupabaseConfig, loadEnabledSources, recordSourceRun, type EventSourceRow } from "@/sources";

export interface RunSummary {
  source: string;
  runId: string;
  events_found: number;
  errors: number;
  persistence: PersistenceResult;
  duration_ms: number;
  ok: boolean;
  message?: string;
}

export interface RunOptions {
  /** Limit the run to a single source key. Useful for the manual-trigger endpoint. */
  source?: string;
  /** Force run even if cadence has not elapsed. */
  force?: boolean;
}

export async function runIngest(env: IngestEnv, options: RunOptions = {}): Promise<RunSummary[]> {
  const supabase = getSupabaseConfig(env);
  const userAgent = env.USER_AGENT ?? "WhatUpFresnoBot/0.1";
  const now = new Date();

  const dbSources = supabase ? await safeLoadSources(supabase, options) : [];
  const planned = options.source
    ? planForKey(options.source, dbSources)
    : planScheduled(dbSources);

  if (planned.length === 0) {
    return [
      {
        source: options.source ?? "all",
        runId: "skipped",
        events_found: 0,
        errors: 0,
        persistence: { persisted: false, reason: supabase ? "No enabled sources are due to run." : "Supabase env vars missing." },
        duration_ms: 0,
        ok: true,
        message: supabase ? "No sources due." : "Skipped: Supabase env vars missing."
      }
    ];
  }

  const maxSources = parsePositiveInt(env.MAX_SOURCES_PER_RUN, 8);
  const cappedPlan = planned.slice(0, maxSources);
  const summaries: RunSummary[] = [];

  for (const plan of cappedPlan) {
    summaries.push(await runOne(env, plan, { now, userAgent, supabase }));
  }

  if (planned.length > cappedPlan.length) {
    console.log(JSON.stringify({
      event: "source_budget_exceeded",
      planned: planned.length,
      executed: cappedPlan.length,
      max_sources_per_run: maxSources
    }));
  }

  if (supabase) {
    try {
      const enriched = await enrichRecentCandidates(env, supabase, parsePositiveInt(env.MAX_ENRICH_PER_RUN, 25));
      if (enriched.processed > 0) {
        console.log(JSON.stringify({ event: "ai_enrichment", ...enriched }));
      }
    } catch (error) {
      console.log(JSON.stringify({ event: "ai_enrichment_failed", message: errorMessage(error) }));
    }
  }

  return summaries;
}

function parsePositiveInt(value: string | undefined, fallback: number) {
  if (!value) return fallback;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? Math.trunc(parsed) : fallback;
}

interface PlanItem {
  key: string;
  config: Record<string, unknown>;
}

function planScheduled(dbSources: EventSourceRow[]): PlanItem[] {
  return dbSources
    .filter((row) => Boolean(findScraper(row.key)))
    .map((row) => ({ key: row.key, config: row.config }));
}

function planForKey(key: string, dbSources: EventSourceRow[]): PlanItem[] {
  if (!findScraper(key)) {
    return [];
  }

  const dbRow = dbSources.find((row) => row.key === key);
  return [{ key, config: dbRow?.config ?? {} }];
}

async function safeLoadSources(supabase: ReturnType<typeof getSupabaseConfig>, options: RunOptions): Promise<EventSourceRow[]> {
  if (!supabase) {
    return [];
  }

  try {
    const all = await loadEnabledSources(supabase, new Date(0));
    return options.force ? all : applyCadence(all);
  } catch (error) {
    console.log(JSON.stringify({ event: "load_sources_failed", message: errorMessage(error) }));
    return [];
  }
}

function applyCadence(rows: EventSourceRow[]): EventSourceRow[] {
  const now = Date.now();
  return rows.filter((row) => {
    if (!row.last_run_at) return true;
    const elapsed = (now - new Date(row.last_run_at).getTime()) / 60000;
    return elapsed >= row.cadence_minutes;
  });
}

interface RunOneContext {
  now: Date;
  userAgent: string;
  supabase: ReturnType<typeof getSupabaseConfig>;
}

async function runOne(env: IngestEnv, plan: PlanItem, ctx: RunOneContext): Promise<RunSummary> {
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

  const scrapeContext: ScrapeContext = {
    runId,
    now: ctx.now,
    userAgent: ctx.userAgent,
    secrets: extractSecrets(env, scraper.requiredSecrets ?? []),
    config: plan.config
  };

  let result: ScrapeResult;
  const runHandler = resolveScraperRun(scraper, env);

  try {
    result = await runHandler(scrapeContext);
  } catch (error) {
    const message = errorMessage(error);
    if (ctx.supabase) {
      try {
        await recordSourceRun(ctx.supabase, plan.key, { last_status: "failed", last_error: message });
      } catch {
        // noop
      }
    }
    return {
      source: plan.key,
      runId,
      events_found: 0,
      errors: 1,
      persistence: { persisted: false, reason: message },
      duration_ms: Math.round(performance.now() - started),
      ok: false,
      message
    };
  }

  const persistence = await persistScrapeResult(env, result);

  if (ctx.supabase) {
    try {
      await recordSourceRun(ctx.supabase, plan.key, {
        last_status: result.errors.length === 0 ? "completed" : "completed_with_errors",
        last_error: result.errors[0]?.message ?? null
      });
    } catch (error) {
      console.log(JSON.stringify({ event: "record_source_run_failed", source: plan.key, message: errorMessage(error) }));
    }
  }

  return {
    source: plan.key,
    runId,
    events_found: result.events.length,
    errors: result.errors.length,
    persistence,
    duration_ms: Math.round(performance.now() - started),
    ok: true
  };
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

/** Exported for testing/manual ad-hoc runs. */
export const allRegisteredSources = scrapers.map((scraper) => ({
  key: scraper.key,
  label: scraper.label,
  enabledByDefault: scraper.enabledByDefault,
  requiredSecrets: scraper.requiredSecrets ?? []
}));
