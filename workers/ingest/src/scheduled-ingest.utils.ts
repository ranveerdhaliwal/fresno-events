import type { IngestEnv } from "@/env";
import { compactRunSummaryForLog } from "@/log-compact.utils";
import type { RunSummary } from "@/runner";

export interface ScheduledIngestDeps {
  runIngest: (
    env: IngestEnv,
    options: { force: true; skipEnrichment: true }
  ) => Promise<RunSummary[]>;
  runPostIngestEnrichment: (env: IngestEnv) => Promise<unknown>;
  log: (message: string) => void;
}

/**
 * Cloudflare cron tick: full promote for every runnable source, then global enrichment
 * for API scrapers (venue-ingest enriches per venue inside its own pipeline).
 */
export async function runScheduledIngest(env: IngestEnv, deps: ScheduledIngestDeps): Promise<void> {
  const summaries = await deps.runIngest(env, { force: true, skipEnrichment: true });

  for (const summary of summaries) {
    deps.log(
      JSON.stringify({
        event: "ingest_run",
        trigger: "scheduled",
        ...compactRunSummaryForLog(summary)
      })
    );
  }

  const enrichment = await deps.runPostIngestEnrichment(env);
  if (enrichment) {
    deps.log(JSON.stringify({ event: "ingest_post_enrichment", trigger: "scheduled", enrichment }));
  }
}
