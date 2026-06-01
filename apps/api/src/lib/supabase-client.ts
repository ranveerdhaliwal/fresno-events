import type { Env } from "@/env";

export function getSupabaseServiceConfig(env: Env): { url: string; key: string } {
  const url = env.SUPABASE_URL?.replace(/\/$/, "");
  const key = env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    throw new Error("Supabase URL and service role key are required.");
  }

  return { url, key };
}

export async function supabaseRequest<T>(
  env: Env,
  path: string,
  init: RequestInit = {}
): Promise<T> {
  const { url, key } = getSupabaseServiceConfig(env);
  const response = await fetch(`${url}${path}`, {
    ...init,
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      Accept: "application/json",
      ...init.headers
    }
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Supabase request failed with ${response.status}: ${body}`);
  }

  return (await response.json()) as T;
}
