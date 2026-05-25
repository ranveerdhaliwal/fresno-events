import type { SupabaseConfig } from "@/sources";

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

function supabaseHeaders(config: SupabaseConfig) {
  return {
    apikey: config.serviceRoleKey,
    Authorization: `Bearer ${config.serviceRoleKey}`,
    Accept: "application/json"
  };
}
