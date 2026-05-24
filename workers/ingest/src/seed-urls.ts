import type { SeedLane } from "@fresno-events/shared";

import type { IngestEnv } from "@/env";
import { getSupabaseConfig } from "@/sources";

export interface SeedUrlRow {
  id: string;
  url: string;
  label: string | null;
  enabled: boolean;
  lane: SeedLane;
  crawl_hints: Record<string, unknown>;
  br_crawl_job_id: string | null;
  br_crawl_status: string | null;
  br_crawl_started_at: string | null;
  last_successful_crawl_at: string | null;
  events_found_last_run: number | null;
}

export type SeedUrlPatch = Partial<
  Pick<
    SeedUrlRow,
    "br_crawl_job_id" | "br_crawl_status" | "br_crawl_started_at" | "last_successful_crawl_at" | "events_found_last_run"
  >
>;

export async function loadEnabledSeedUrls(
  env: IngestEnv,
  options: { lane?: SeedLane } = {}
): Promise<SeedUrlRow[]> {
  const supabase = getSupabaseConfig(env);
  if (!supabase) {
    return [];
  }

  const params = new URLSearchParams({
    select:
      "id,url,label,enabled,lane,crawl_hints,br_crawl_job_id,br_crawl_status,br_crawl_started_at,last_successful_crawl_at,events_found_last_run",
    enabled: "eq.true",
    order: "url.asc"
  });

  if (options.lane) {
    params.set("lane", `eq.${options.lane}`);
  }

  const response = await fetch(`${supabase.url}/rest/v1/seed_urls?${params}`, {
    headers: {
      apikey: supabase.serviceRoleKey,
      Authorization: `Bearer ${supabase.serviceRoleKey}`,
      Accept: "application/json"
    }
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`seed_urls query failed (${response.status}): ${body}`);
  }

  return (await response.json()) as SeedUrlRow[];
}

export async function updateSeed(env: IngestEnv, id: string, patch: SeedUrlPatch): Promise<void> {
  const supabase = getSupabaseConfig(env);
  if (!supabase) {
    throw new Error("Supabase is not configured.");
  }

  const response = await fetch(`${supabase.url}/rest/v1/seed_urls?id=eq.${id}`, {
    method: "PATCH",
    headers: {
      apikey: supabase.serviceRoleKey,
      Authorization: `Bearer ${supabase.serviceRoleKey}`,
      "Content-Type": "application/json",
      Prefer: "return=minimal"
    },
    body: JSON.stringify({ ...patch, updated_at: new Date().toISOString() })
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`seed_urls update failed (${response.status}): ${body}`);
  }
}
