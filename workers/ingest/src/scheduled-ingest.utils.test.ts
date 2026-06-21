import { describe, expect, it, vi } from "vitest";

import type { IngestEnv } from "@/env";
import type { RunSummary } from "@/runner";
import { runScheduledIngest } from "@/scheduled-ingest.utils";

const env = {} as IngestEnv;

const baseSummary: RunSummary = {
  source: "ticketmaster",
  runId: "run-1",
  events_found: 3,
  errors: 0,
  persistence: { persisted: true, candidates: 3 },
  duration_ms: 100,
  ok: true
};

describe("runScheduledIngest", () => {
  it("runs all sources with force and skipEnrichment, then post-ingest enrichment", async () => {
    const runIngest = vi.fn().mockResolvedValue([baseSummary]);
    const runPostIngestEnrichment = vi.fn().mockResolvedValue({ enriched: 2 });
    const log = vi.fn();

    await runScheduledIngest(env, { runIngest, runPostIngestEnrichment, log });

    expect(runIngest).toHaveBeenCalledWith(env, { force: true, skipEnrichment: true });
    expect(runPostIngestEnrichment).toHaveBeenCalledWith(env);
    expect(log).toHaveBeenCalledWith(expect.stringContaining('"trigger":"scheduled"'));
    expect(log).toHaveBeenCalledWith(expect.stringContaining("ingest_post_enrichment"));
  });

  it("still runs post-ingest enrichment when ingest returns no summaries", async () => {
    const runIngest = vi.fn().mockResolvedValue([]);
    const runPostIngestEnrichment = vi.fn().mockResolvedValue(null);

    await runScheduledIngest(env, {
      runIngest,
      runPostIngestEnrichment,
      log: vi.fn()
    });

    expect(runPostIngestEnrichment).toHaveBeenCalledWith(env);
  });
});
