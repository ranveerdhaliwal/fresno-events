import type { SupabaseConfig } from "@/sources";

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

function supabaseHeaders(config: SupabaseConfig) {
  return {
    apikey: config.serviceRoleKey,
    Authorization: `Bearer ${config.serviceRoleKey}`,
    Accept: "application/json"
  };
}
