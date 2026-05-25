import type { IngestEnv } from "@/env";
import { fetchIngestRunStatsBySource, fetchLastRunStartedAt } from "@/ingest-runs";
import { getJsonPromptBackend } from "@/llm/registry";
import { findScraper, scrapers, type RegisteredScraper } from "@/registry";
import { getSupabaseConfig, type SupabaseConfig } from "@/sources";

export interface PlanItem {
  key: string;
  config: Record<string, unknown>;
}

export interface PlanOptions {
  /** One key, comma-separated keys, or `all`. Omit to use cron defaults. */
  sources?: string;
  /** Run even if cadence has not elapsed. With no `sources`, runs every runnable source. */
  force?: boolean;
}

/**
 * Decide which scrapers to run. All source definitions live in registry.ts (+ civic-urls.ts).
 * Cadence uses ingest_runs history, not event_sources.
 */
export async function planIngestRuns(env: IngestEnv, options: PlanOptions = {}): Promise<PlanItem[]> {
  const supabase = getSupabaseConfig(env);
  const keys = parseSourceKeys(options.sources);

  if (keys.length > 0) {
    const plans: PlanItem[] = [];
    for (const key of keys) {
      const item = planOne(env, key);
      if (item) {
        plans.push(item);
      }
    }
    return plans;
  }

  return planCronBatch(env, supabase, options.force ?? false);
}

function parseSourceKeys(sources: string | undefined): string[] {
  if (!sources?.trim()) {
    return [];
  }

  const trimmed = sources.trim();
  if (trimmed === "all") {
    return scrapers.map((s) => s.key);
  }

  return trimmed
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);
}

function planOne(env: IngestEnv, key: string): PlanItem | null {
  const scraper = findScraper(key);
  if (!scraper) {
    return null;
  }

  if (!canRunScraper(env, scraper)) {
    return null;
  }

  return { key, config: scraper.defaultConfig ?? {} };
}

async function planCronBatch(env: IngestEnv, supabase: SupabaseConfig | null, force: boolean): Promise<PlanItem[]> {
  const plans: PlanItem[] = [];
  const skipped: Array<{ key: string; reason: string }> = [];

  for (const scraper of scrapers) {
    if (!force && scraper.schedule === "manual-only") {
      continue;
    }
    if (!canRunScraper(env, scraper)) {
      skipped.push({ key: scraper.key, reason: "missing_secrets_or_provider" });
      continue;
    }
    if (!force && supabase) {
      const due = await isDue(supabase, scraper);
      if (!due) {
        continue;
      }
    }

    plans.push({ key: scraper.key, config: scraper.defaultConfig ?? {} });
  }

  if (skipped.length > 0) {
    console.log(JSON.stringify({ event: "ingest_plan_skipped", skipped }));
  }

  return plans;
}

/** Oldest last-run first so MAX_SOURCES_PER_RUN does not starve infrequent sources. */
export async function sortPlanByStalest(
  plans: PlanItem[],
  supabase: SupabaseConfig | null
): Promise<PlanItem[]> {
  if (!supabase || plans.length <= 1) {
    return plans;
  }

  const stats = await fetchIngestRunStatsBySource(supabase);
  return [...plans].sort((a, b) => {
    const aMs = stats.get(a.key)?.lastRunAt ? new Date(stats.get(a.key)!.lastRunAt!).getTime() : 0;
    const bMs = stats.get(b.key)?.lastRunAt ? new Date(stats.get(b.key)!.lastRunAt!).getTime() : 0;
    return aMs - bMs;
  });
}

async function isDue(supabase: SupabaseConfig, scraper: RegisteredScraper): Promise<boolean> {
  const last = await fetchLastRunStartedAt(supabase, scraper.key);
  if (!last) {
    return true;
  }

  const elapsedMinutes = (Date.now() - last.getTime()) / 60000;
  return elapsedMinutes >= scraper.defaultCadenceMinutes;
}

export function canRunScraper(env: IngestEnv, scraper: RegisteredScraper): boolean {
  for (const secretKey of scraper.requiredSecrets ?? []) {
    const value = env[secretKey];
    if (typeof value !== "string" || !value.trim()) {
      return false;
    }
  }

  if (scraper.key === "ai-discovery" && !getJsonPromptBackend(env, "discovery")) {
    return false;
  }

  return true;
}

export interface RunnableSourceInfo {
  key: string;
  label: string;
  schedule: RegisteredScraper["schedule"];
  defaultCadenceMinutes: number;
  runnable: boolean;
  requiredSecrets: string[];
  lastRunAt: string | null;
  lastEventsFound: number | null;
}

export async function listRunnableSources(env: IngestEnv): Promise<RunnableSourceInfo[]> {
  const supabase = getSupabaseConfig(env);
  const stats = supabase ? await fetchIngestRunStatsBySource(supabase) : new Map();

  return scrapers.map((scraper) => {
    const runStats = stats.get(scraper.key);
    return {
      key: scraper.key,
      label: scraper.label,
      schedule: scraper.schedule,
      defaultCadenceMinutes: scraper.defaultCadenceMinutes,
      runnable: canRunScraper(env, scraper),
      requiredSecrets: [...(scraper.requiredSecrets ?? [])],
      lastRunAt: runStats?.lastRunAt ?? null,
      lastEventsFound: runStats?.lastEventsFound ?? null
    };
  });
}
