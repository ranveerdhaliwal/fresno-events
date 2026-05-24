import type { CoordinatorMode, NormalizedEvent, ScrapeError, ScrapeSeedMetric } from "@fresno-events/shared";

import { extractEventsFromMarkdown, type ExtractorVariant } from "@/ai/extractor";
import { buildCrawlRequest, CRAWL_LIMITS } from "@/browser-rendering/crawl-defaults";
import type { CrawlTarget, ParsedCrawlHints } from "@/browser-rendering/crawl-targets.utils";
import { resolveCrawlTargets, shouldLogPoll } from "@/browser-rendering/crawl-targets.utils";
import { applyFestivalMetadata } from "@/browser-rendering/festival-expand.utils";
import * as brClient from "@/browser-rendering/crawl-client";
import type { IngestEnv } from "@/env";
import { toNormalizedEventFromDiscovery } from "@/normalized-event";
import { type SeedUrlRow, updateSeed } from "@/seed-urls";

export interface CoordinatorProgress {
  seedIndex: number;
  seedTotal: number;
}

export interface CoordinatorContext {
  mode: CoordinatorMode;
  llmCalls: number;
  errors: ScrapeError[];
  progress?: CoordinatorProgress;
  /** When aborted (client disconnect / worker shutdown), in-flight BR jobs are cancelled. */
  abortSignal?: AbortSignal;
}

export interface CoordinatorResult {
  events: NormalizedEvent[];
  errors: ScrapeError[];
  metrics: { pagesVisited: number; llmCalls: number };
  seedMetrics: ScrapeSeedMetric[];
}

function isTerminal(status: string | null | undefined): boolean {
  if (!status) {
    return false;
  }
  return status === "completed" || status.startsWith("errored") || status.startsWith("cancelled");
}

function sleep(ms: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms));
}

function throwIfAborted(signal: AbortSignal | undefined) {
  if (signal?.aborted) {
    throw new DOMException("Ingest aborted", "AbortError");
  }
}

async function cancelJobQuietly(env: IngestEnv, jobId: string, url: string) {
  try {
    await brClient.cancelCrawlJob(env, jobId);
    logAiCrawl({ step: "br_crawl_cancelled", url, jobId });
  } catch (error) {
    logAiCrawl({
      step: "br_crawl_cancel_failed",
      url,
      jobId,
      message: error instanceof Error ? error.message : String(error)
    });
  }
}

function logAiCrawl(payload: Record<string, unknown>) {
  console.log(JSON.stringify({ event: "ai_crawl", ...payload }));
}

function extractorVariant(hints: ParsedCrawlHints): ExtractorVariant {
  if (hints.extractorVariant === "festival" || hints.provider === "festival") {
    return "festival";
  }
  if (hints.extractorVariant === "headline_only" || hints.provider === "headline_only") {
    return "headline_only";
  }
  return "default";
}

async function processTarget(
  env: IngestEnv,
  seed: SeedUrlRow,
  target: CrawlTarget,
  hints: ParsedCrawlHints,
  ctx: CoordinatorContext,
  pagesVisited: { count: number },
  opts: { canResumeSeedJob: boolean }
): Promise<NormalizedEvent[]> {
  const persistSeedState = ctx.mode !== "dry-run";
  const mayStartNewJob = ctx.mode !== "resume-jobs";
  const isWindowUrl = target.url !== seed.url;
  let jobId: string | null = opts.canResumeSeedJob && !isWindowUrl ? seed.br_crawl_job_id : null;
  let shouldCancelOnAbort = false;

  logAiCrawl({
    step: target.windowTotal && target.windowTotal > 1 ? "ticketsauce_window" : "target_start",
    url: target.url,
    seedUrl: seed.url,
    ...(seed.label ? { label: seed.label } : {}),
    ...(target.windowIndex ? { windowIndex: target.windowIndex, windowTotal: target.windowTotal } : {}),
    ...(target.windowStart ? { windowStart: target.windowStart, windowEnd: target.windowEnd } : {}),
    ...(ctx.progress
      ? { seedIndex: ctx.progress.seedIndex, seedTotal: ctx.progress.seedTotal }
      : {}),
    provider: hints.provider
  });

  const crawlBody = buildCrawlRequest(seed, env, { targetUrl: target.url, hints, isWindowUrl });

  if (ctx.mode === "dry-run") {
    logAiCrawl({
      step: "br_crawl_plan",
      url: target.url,
      seedUrl: seed.url,
      limit: crawlBody.limit,
      depth: crawlBody.depth,
      render: crawlBody.render,
      formats: crawlBody.formats,
      note: "dry-run — no Browser Rendering job started"
    });
    return [];
  }

  throwIfAborted(ctx.abortSignal);

  try {
    if (!jobId || isTerminal(seed.br_crawl_status)) {
      if (!mayStartNewJob) {
        logAiCrawl({ step: "target_skip", url: target.url, reason: "resume-jobs and no active BR job" });
        return [];
      }

      logAiCrawl({ step: "br_crawl_start", url: target.url, seedUrl: seed.url });
      jobId = await brClient.startCrawl(env, crawlBody);
      shouldCancelOnAbort = true;
      logAiCrawl({ step: "br_crawl_started", url: target.url, jobId });
      if (persistSeedState && opts.canResumeSeedJob && !isWindowUrl) {
        await updateSeed(env, seed.id, {
          br_crawl_job_id: jobId,
          br_crawl_status: "running",
          br_crawl_started_at: new Date().toISOString()
        });
      }
    } else {
      shouldCancelOnAbort = true;
      logAiCrawl({
        step: "br_crawl_resume",
        url: target.url,
        jobId,
        status: seed.br_crawl_status
      });
    }

    const pollStarted = Date.now();
    const deadline = pollStarted + CRAWL_LIMITS.PER_SEED_POLL_TIMEOUT_MS;
    let status = "running";
    let pollCount = 0;
    let lastLoggedAtMs = 0;
    let lastStatus = status;
    const pageLimit = hints.provider === "ticketsauce" || hints.provider === "listing_page" ? 1 : 30;

    while (status === "running" && Date.now() < deadline) {
      throwIfAborted(ctx.abortSignal);
      pollCount += 1;
      const job = await brClient.getCrawlJob(env, jobId, { limit: 1 });
      status = job.status;
      const elapsedMs = Date.now() - pollStarted;
      const statusChanged = status !== lastStatus;
      const pagesCompleted = job.records?.length ?? 0;

      if (
        shouldLogPoll({
          pollCount,
          elapsedMs,
          statusChanged,
          lastLoggedAtMs,
          logIntervalMs: CRAWL_LIMITS.POLL_LOG_INTERVAL_MS
        })
      ) {
        lastLoggedAtMs = elapsedMs;
        logAiCrawl({
          step: "br_crawl_poll",
          url: target.url,
          seedUrl: seed.url,
          jobId,
          status,
          poll: pollCount,
          elapsedSec: Math.round(elapsedMs / 1000),
          remainingSec: Math.max(0, Math.round((deadline - Date.now()) / 1000)),
          pagesCompleted,
          pageLimit,
          ...(target.windowIndex ? { windowIndex: target.windowIndex, windowTotal: target.windowTotal } : {}),
          ...(ctx.progress
            ? { seedIndex: ctx.progress.seedIndex, seedTotal: ctx.progress.seedTotal }
            : {})
        });
      }
      lastStatus = status;

      if (persistSeedState && opts.canResumeSeedJob && !isWindowUrl) {
        await updateSeed(env, seed.id, { br_crawl_status: status });
      }
      if (status === "running") {
        await sleep(CRAWL_LIMITS.POLL_INTERVAL_MS);
      }
    }

    if (status !== "completed") {
      logAiCrawl({ step: "br_crawl_incomplete", url: target.url, jobId, status });
      ctx.errors.push({
        source: "ai-crawl",
        url: target.url,
        message: `BR job ${jobId} still ${status}`,
        recoverable: true
      });
      return [];
    }

    const records = await brClient.fetchAllRecords(env, jobId);
    pagesVisited.count += records.length;
    logAiCrawl({
      step: "br_crawl_records",
      url: target.url,
      jobId,
      recordCount: records.length,
      completedWithMarkdown: records.filter((r) => r.status === "completed" && r.markdown?.trim()).length
    });

    const variant = extractorVariant(hints);
    const dateRange =
      target.windowStart && target.windowEnd
        ? { start: target.windowStart, end: target.windowEnd }
        : undefined;

    const events: NormalizedEvent[] = [];

    for (const record of records) {
      if (record.status !== "completed" || !record.markdown?.trim()) {
        continue;
      }
      if (ctx.llmCalls >= CRAWL_LIMITS.MAX_LLM_CALLS_PER_RUN) {
        break;
      }

      throwIfAborted(ctx.abortSignal);
      logAiCrawl({ step: "llm_extract_start", seedUrl: seed.url, pageUrl: record.url });
      const extractArgs = {
        url: record.url,
        label: seed.label ?? seed.url,
        markdown: record.markdown.slice(0, CRAWL_LIMITS.MARKDOWN_CHAR_LIMIT),
        variant
      };
      const extracted = await extractEventsFromMarkdown(
        env,
        dateRange ? { ...extractArgs, dateRange } : extractArgs
      );
      ctx.llmCalls += 1;
      logAiCrawl({
        step: "llm_extract_done",
        seedUrl: seed.url,
        pageUrl: record.url,
        rawCount: extracted.length
      });

      for (const item of extracted) {
        const normalized = toNormalizedEventFromDiscovery(item, record.url, seed.url, "ai-crawl");
        if (normalized) {
          events.push(normalized);
        }
      }
    }

    return applyFestivalMetadata(events, hints);
  } catch (error) {
    if (jobId && shouldCancelOnAbort && error instanceof DOMException && error.name === "AbortError") {
      await cancelJobQuietly(env, jobId, target.url);
      if (persistSeedState && opts.canResumeSeedJob && !isWindowUrl) {
        await updateSeed(env, seed.id, {
          br_crawl_job_id: null,
          br_crawl_status: "cancelled_by_user"
        });
      }
    }
    throw error;
  }
}

async function processSeed(
  env: IngestEnv,
  seed: SeedUrlRow,
  ctx: CoordinatorContext,
  pagesVisited: { count: number }
): Promise<{ events: NormalizedEvent[]; eventsFound: number }> {
  const persistSeedState = ctx.mode !== "dry-run";
  const { hints, targets } = resolveCrawlTargets(seed, new Date());
  const canResumeSeedJob = targets.length === 1 && targets[0]?.url === seed.url;

  logAiCrawl({
    step: "seed_start",
    mode: ctx.mode,
    url: seed.url,
    provider: hints.provider,
    targetCount: targets.length,
    ...(seed.label ? { label: seed.label } : {}),
    ...(ctx.progress
      ? { seedIndex: ctx.progress.seedIndex, seedTotal: ctx.progress.seedTotal }
      : {})
  });

  const events: NormalizedEvent[] = [];

  for (const target of targets) {
    const targetEvents = await processTarget(env, seed, target, hints, ctx, pagesVisited, {
      canResumeSeedJob
    });
    events.push(...targetEvents);
  }

  if (persistSeedState) {
    await updateSeed(env, seed.id, {
      br_crawl_job_id: null,
      br_crawl_status: "completed",
      last_successful_crawl_at: new Date().toISOString(),
      events_found_last_run: events.length
    });
  }

  logAiCrawl({
    step: "seed_done",
    url: seed.url,
    eventsFound: events.length,
    llmCallsThisRun: ctx.llmCalls,
    provider: hints.provider
  });
  return { events, eventsFound: events.length };
}

export async function runCoordinator(
  env: IngestEnv,
  seeds: SeedUrlRow[],
  mode: CoordinatorMode,
  options: { abortSignal?: AbortSignal } = {}
): Promise<CoordinatorResult> {
  const ctx: CoordinatorContext = {
    mode,
    llmCalls: 0,
    errors: [],
    ...(options.abortSignal ? { abortSignal: options.abortSignal } : {})
  };
  const allEvents: NormalizedEvent[] = [];
  const seedMetrics: ScrapeSeedMetric[] = [];
  const pagesVisited = { count: 0 };
  const seedTotal = seeds.length;

  logAiCrawl({
    step: "coordinator_start",
    mode,
    seedCount: seedTotal,
    seeds: seeds.map((s) => ({ url: s.url, ...(s.label ? { label: s.label } : {}) }))
  });

  for (let i = 0; i < seeds.length; i += 1) {
    const seed = seeds[i];
    if (!seed) {
      continue;
    }
    ctx.progress = { seedIndex: i + 1, seedTotal };
    const { events, eventsFound } = await processSeed(env, seed, ctx, pagesVisited);
    allEvents.push(...events);
    seedMetrics.push({
      url: seed.url,
      ...(seed.label ? { label: seed.label } : {}),
      eventsFound
    });
    await sleep(CRAWL_LIMITS.PER_SEED_DELAY_MS);
  }

  logAiCrawl({
    step: "coordinator_done",
    mode,
    eventsFound: allEvents.length,
    pagesVisited: pagesVisited.count,
    llmCalls: ctx.llmCalls,
    errorCount: ctx.errors.length
  });

  return {
    events: allEvents,
    errors: ctx.errors,
    metrics: { pagesVisited: pagesVisited.count, llmCalls: ctx.llmCalls },
    seedMetrics
  };
}
