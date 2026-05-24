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
