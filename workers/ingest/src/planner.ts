import type { IngestEnv } from "@/env";
import { fetchLastRunStartedAt } from "@/ingest-runs";
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

  for (const scraper of scrapers) {
    if (!force && !scraper.enabledByDefault) {
      continue;
    }
    if (!canRunScraper(env, scraper)) {
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

  return plans;
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

export function listRunnableSources(env: IngestEnv) {
  return scrapers.map((scraper) => ({
    key: scraper.key,
    label: scraper.label,
    enabledByDefault: scraper.enabledByDefault,
    defaultCadenceMinutes: scraper.defaultCadenceMinutes,
    runnable: canRunScraper(env, scraper),
    requiredSecrets: scraper.requiredSecrets ?? []
  }));
}
