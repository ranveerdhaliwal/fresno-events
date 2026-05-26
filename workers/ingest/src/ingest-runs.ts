import type { IngestEnv } from "@/env";
import { getSupabaseConfig, type SupabaseConfig } from "@/sources";

export interface IngestRunSourceStats {
  lastRunAt: string | null;
  lastEventsFound: number | null;
}

export async function fetchLastRunStartedAt(
  config: SupabaseConfig,
  source: string
): Promise<Date | null> {
  const params = new URLSearchParams({
    select: "started_at",
    source: `eq.${source}`,
    order: "started_at.desc",
    limit: "1"
  });

  const response = await fetch(`${config.url}/rest/v1/ingest_runs?${params}`, {
    headers: supabaseHeaders(config)
  });

  if (!response.ok) {
    return null;
  }

  const rows = (await response.json()) as Array<{ started_at: string }>;
  const started = rows[0]?.started_at;
  return started ? new Date(started) : null;
}

/** Latest run per source from recent history (no SQL group-by required). */
export async function fetchIngestRunStatsBySource(
  config: SupabaseConfig,
  limit = 200
): Promise<Map<string, IngestRunSourceStats>> {
  const params = new URLSearchParams({
    select: "source,started_at,events_found",
    order: "started_at.desc",
    limit: String(limit)
  });

  const response = await fetch(`${config.url}/rest/v1/ingest_runs?${params}`, {
    headers: supabaseHeaders(config)
  });

  const out = new Map<string, IngestRunSourceStats>();
  if (!response.ok) {
    return out;
  }

  const rows = (await response.json()) as Array<{
    source: string;
    started_at: string;
    events_found: number;
  }>;

  for (const row of rows) {
    if (!out.has(row.source)) {
      out.set(row.source, {
        lastRunAt: row.started_at,
        lastEventsFound: row.events_found
      });
    }
  }

  return out;
}

function supabaseHeaders(config: SupabaseConfig, prefer?: string) {
  return {
    apikey: config.serviceRoleKey,
    Authorization: `Bearer ${config.serviceRoleKey}`,
    Accept: "application/json",
    ...(prefer ? { Prefer: prefer } : {})
  };
}

/** Upsert parent row so venue_ingest_* FKs succeed before persistScrapeResult (or on dry-run). */
export async function ensureIngestRunStarted(
  env: IngestEnv,
  opts: { runId: string; source: string; dryRun?: boolean }
): Promise<void> {
  const config = getSupabaseConfig(env);
  if (!config) {
    throw new Error("Supabase is not configured.");
  }

  const response = await fetch(`${config.url}/rest/v1/ingest_runs?on_conflict=id`, {
    method: "POST",
    headers: {
      ...supabaseHeaders(config, "resolution=merge-duplicates,return=minimal"),
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      id: opts.runId,
      source: opts.source,
      status: opts.dryRun ? "dry_run" : "running",
      started_at: new Date().toISOString(),
      events_found: 0,
      errors_count: 0,
      metrics: {}
    })
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`ingest_runs upsert failed (${response.status}): ${body}`);
  }
}

/** Close ingest_runs on dry-run (real runs still use persistScrapeResult). */
export async function finishIngestRunRecord(
  env: IngestEnv,
  opts: {
    runId: string;
    source: string;
    eventsFound: number;
    errorsCount: number;
    metrics: Record<string, unknown>;
    dryRun: boolean;
  }
): Promise<void> {
  const config = getSupabaseConfig(env);
  if (!config) {
    return;
  }

  const status =
    opts.dryRun
      ? "dry_run"
      : opts.errorsCount > 0
        ? "completed_with_errors"
        : "completed";

  const response = await fetch(`${config.url}/rest/v1/ingest_runs?id=eq.${opts.runId}`, {
    method: "PATCH",
    headers: {
      ...supabaseHeaders(config, "return=minimal"),
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      status,
      events_found: opts.eventsFound,
      errors_count: opts.errorsCount,
      metrics: opts.metrics,
      finished_at: new Date().toISOString()
    })
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`ingest_runs patch failed (${response.status}): ${body}`);
  }
}
