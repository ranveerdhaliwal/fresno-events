import type { IngestEnv } from "@/env";

export const fresnoSearchArea = {
  lat: 36.7378,
  lng: -119.7871,
  radiusMiles: 50
};

export interface SupabaseConfig {
  url: string;
  serviceRoleKey: string;
}

export function getSupabaseConfig(env: IngestEnv): SupabaseConfig | null {
  const url = env.SUPABASE_URL?.replace(/\/$/, "");
  const serviceRoleKey = env.SUPABASE_SERVICE_ROLE_KEY;
  return url && serviceRoleKey ? { url, serviceRoleKey } : null;
}

export function supabaseHeaders(supabase: SupabaseConfig, extra: Record<string, string> = {}) {
  return {
    apikey: supabase.serviceRoleKey,
    Authorization: `Bearer ${supabase.serviceRoleKey}`,
    Accept: "application/json",
    ...extra
  };
}

export async function supabaseFetch<T>(
  supabase: SupabaseConfig,
  path: string,
  init: RequestInit = {}
): Promise<T> {
  const response = await fetch(`${supabase.url}${path}`, {
    ...init,
    headers: {
      ...supabaseHeaders(supabase),
      ...(init.headers as Record<string, string> | undefined)
    }
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Supabase request ${path} failed: ${response.status} ${body}`);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return (await response.json()) as T;
}
