import type { IngestEnv } from "@/env";

export const fresnoSearchArea = {
  lat: 36.7378,
  lng: -119.7871,
  radiusMiles: 50
};

export interface EventSourceRow {
  id: string;
  key: string;
  label: string;
  kind: "api" | "scrape" | "ai_discovery" | "manual";
  config: Record<string, unknown>;
  cadence_minutes: number;
  enabled: boolean;
  last_run_at: string | null;
  last_status: string | null;
  last_error: string | null;
}

export interface SupabaseConfig {
  url: string;
  serviceRoleKey: string;
}

export function getSupabaseConfig(env: IngestEnv): SupabaseConfig | null {
  const url = env.SUPABASE_URL?.replace(/\/$/, "");
  const serviceRoleKey = env.SUPABASE_SERVICE_ROLE_KEY;
  return url && serviceRoleKey ? { url, serviceRoleKey } : null;
}

export async function loadEnabledSources(config: SupabaseConfig, now: Date): Promise<EventSourceRow[]> {
  const params = new URLSearchParams({
    select: "*",
    enabled: "eq.true",
    order: "key.asc"
  });

  const response = await fetch(`${config.url}/rest/v1/event_sources?${params}`, {
    headers: supabaseHeaders(config)
  });

  if (!response.ok) {
    throw new Error(`Failed to load event_sources: ${response.status} ${await response.text()}`);
  }

  const rows = await response.json() as EventSourceRow[];
  return rows.filter((row) => isDue(row, now));
}

export async function recordSourceRun(
  config: SupabaseConfig,
  key: string,
  patch: { last_status: string; last_error: string | null }
) {
  const params = new URLSearchParams({ key: `eq.${key}` });
  const response = await fetch(`${config.url}/rest/v1/event_sources?${params}`, {
    method: "PATCH",
    headers: {
      ...supabaseHeaders(config),
      "Content-Type": "application/json",
      Prefer: "return=minimal"
    },
    body: JSON.stringify({ ...patch, last_run_at: new Date().toISOString() })
  });

  if (!response.ok) {
    throw new Error(`Failed to record source run for ${key}: ${response.status} ${await response.text()}`);
  }
}

function supabaseHeaders(config: SupabaseConfig) {
  return {
    apikey: config.serviceRoleKey,
    Authorization: `Bearer ${config.serviceRoleKey}`,
    Accept: "application/json"
  };
}

function isDue(row: EventSourceRow, now: Date) {
  if (!row.last_run_at) {
    return true;
  }

  const last = new Date(row.last_run_at).getTime();
  const elapsedMinutes = (now.getTime() - last) / 60000;
  return elapsedMinutes >= row.cadence_minutes;
}
