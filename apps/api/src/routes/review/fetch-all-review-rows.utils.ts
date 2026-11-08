import type { Env } from "@/env";
import { supabaseReviewRequest } from "@/routes/review/supabase.utils";

/** REST max_rows applies even when the client asks for 5,000 records. */
export async function fetchAllReviewRows<T>(
  env: Env,
  table: "events" | "event_candidates",
  filters: Record<string, string>
): Promise<T[]> {
  const all: T[] = [];
  const pageSize = 500;
  for (let offset = 0; ; offset += pageSize) {
    const params = new URLSearchParams({ ...filters, order: "id.asc", limit: String(pageSize), offset: String(offset) });
    const page = await supabaseReviewRequest<T[]>(env, `/rest/v1/${table}?${params}`);
    all.push(...page);
    if (page.length < pageSize) return all;
  }
}
