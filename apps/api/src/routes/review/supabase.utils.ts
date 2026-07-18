import type { Env } from "@/env";
import { supabaseRequest as supabaseRequestBase } from "@/lib/supabase-client";
import { logError } from "@/lib/structured-log";
import { ReviewRouteError } from "@/routes/review/errors";

export async function supabaseReviewRequest<T>(
  env: Env,
  path: string,
  init: RequestInit = {}
): Promise<T> {
  try {
    return await supabaseRequestBase<T>(env, path, init);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const statusMatch = message.match(/failed with (\d+):/);
    const status = statusMatch ? Number(statusMatch[1]) : 502;
    const err = new ReviewRouteError(
      `Supabase review query failed with ${status}: ${message.split(": ").slice(1).join(": ") || message}`,
      status === 401 ? 503 : 502
    );
    logError("supabase_review_request_failed", err, { path, status });
    throw err;
  }
}

export function getSupabaseServiceConfigOrThrow(env: Env): { url: string; key: string } {
  const url = env.SUPABASE_URL?.replace(/\/$/, "");
  const key = env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    throw new ReviewRouteError("Supabase URL and service role key are required for review routes.", 503);
  }

  return { url, key };
}
