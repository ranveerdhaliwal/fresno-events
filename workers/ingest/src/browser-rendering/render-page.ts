import * as brClient from "@/browser-rendering/crawl-client";
import { CRAWL_LIMITS, DEFAULT_REJECT_RESOURCE_TYPES } from "@/browser-rendering/crawl-defaults";
import { sleep } from "@/lib/sleep";
import type { BrCrawlRequestBody } from "@/browser-rendering/types";
import type { IngestEnv } from "@/env";

export interface RenderUrlOptions {
  signal?: AbortSignal;
}

function buildShallowCrawlBody(url: string, formats: string[]): BrCrawlRequestBody {
  return {
    url,
    limit: CRAWL_LIMITS.SHALLOW_LIMIT,
    depth: CRAWL_LIMITS.SHALLOW_DEPTH,
    render: true,
    formats,
    rejectResourceTypes: [...DEFAULT_REJECT_RESOURCE_TYPES],
    crawlPurposes: ["search", "ai-input"],
    options: {
      includeExternalLinks: false,
      includeSubdomains: false
    }
  };
}

function throwIfAborted(signal: AbortSignal | undefined) {
  if (signal?.aborted) {
    throw new DOMException("Ingest aborted", "AbortError");
  }
}

function brCredentialsMissing(env: IngestEnv): string | null {
  const accountId = env.CLOUDFLARE_ACCOUNT_ID?.trim();
  const token = env.CLOUDFLARE_API_TOKEN?.trim();
  if (!accountId || !token) {
    return "CLOUDFLARE_ACCOUNT_ID and CLOUDFLARE_API_TOKEN are required.";
  }
  return null;
}

async function runShallowCrawlJob(
  env: IngestEnv,
  url: string,
  formats: string[],
  opts: RenderUrlOptions = {}
): Promise<{ jobId: string } | { error: string }> {
  const missing = brCredentialsMissing(env);
  if (missing) {
    return { error: missing };
  }

  const body = buildShallowCrawlBody(url, formats);
  let jobId: string;

  try {
    throwIfAborted(opts.signal);
    jobId = await brClient.startCrawl(env, body);
    console.log(
      JSON.stringify({
        event: "br_crawl",
        step: "start_ok",
        job_id: jobId,
        url,
        formats
      })
    );
  } catch (error) {
    return { error: error instanceof Error ? error.message : "BR crawl start failed" };
  }

  const deadline = Date.now() + CRAWL_LIMITS.PER_SEED_POLL_TIMEOUT_MS;
  let status = "running";
  let lastPollLogAt = 0;

  console.log(
    JSON.stringify({
      event: "br_crawl",
      step: "poll_start",
      job_id: jobId,
      url,
      formats
    })
  );

  while (status === "running" && Date.now() < deadline) {
    throwIfAborted(opts.signal);
    try {
      const job = await brClient.getCrawlJob(env, jobId, { limit: 1 });
      status = job.status;
      const now = Date.now();
      if (status === "running" && now - lastPollLogAt >= CRAWL_LIMITS.POLL_LOG_INTERVAL_MS) {
        lastPollLogAt = now;
        console.log(
          JSON.stringify({
            event: "br_crawl",
            step: "poll_tick",
            job_id: jobId,
            url,
            status,
            elapsed_ms: now - (deadline - CRAWL_LIMITS.PER_SEED_POLL_TIMEOUT_MS)
          })
        );
      }
      if (status === "running") {
        await sleep(CRAWL_LIMITS.POLL_INTERVAL_MS);
      }
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") {
        await brClient.cancelCrawlJob(env, jobId).catch(() => undefined);
        throw error;
      }
      return { error: error instanceof Error ? error.message : "BR poll failed" };
    }
  }

  if (status !== "completed") {
    console.log(
      JSON.stringify({
        event: "br_crawl",
        step: "poll_end",
        job_id: jobId,
        url,
        status,
        ok: false
      })
    );
    return { error: `BR job ${jobId} ended with status ${status}` };
  }

  console.log(
    JSON.stringify({
      event: "br_crawl",
      step: "poll_end",
      job_id: jobId,
      url,
      status,
      ok: true
    })
  );

  return { jobId };
}

/**
 * Shallow Browser Rendering crawl (limit 1, depth 1) for a single page URL.
 */
export async function renderUrlToMarkdown(
  env: IngestEnv,
  url: string,
  opts: RenderUrlOptions = {}
): Promise<{ markdown: string } | { error: string }> {
  const job = await runShallowCrawlJob(env, url, ["markdown"], opts);
  if ("error" in job) {
    return { error: job.error };
  }

  try {
    const records = await brClient.fetchAllRecords(env, job.jobId);
    const markdown = records
      .filter((r) => r.status === "completed" && r.markdown?.trim())
      .map((r) => r.markdown!)
      .join("\n\n")
      .slice(0, CRAWL_LIMITS.MARKDOWN_CHAR_LIMIT);

    if (!markdown.trim()) {
      return { error: "BR job completed but no markdown returned" };
    }

    return { markdown };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "BR fetch records failed" };
  }
}

/** Shallow BR crawl returning rendered HTML (for cheerio parsers on SPA sites). */
export async function renderUrlToHtml(
  env: IngestEnv,
  url: string,
  opts: RenderUrlOptions = {}
): Promise<{ html: string } | { error: string }> {
  const job = await runShallowCrawlJob(env, url, ["html"], opts);
  if ("error" in job) {
    return { error: job.error };
  }

  try {
    const records = await brClient.fetchAllRecords(env, job.jobId);
    const html = records
      .filter((r) => r.status === "completed" && r.html?.trim())
      .map((r) => r.html!)
      .join("\n")
      .slice(0, CRAWL_LIMITS.MARKDOWN_CHAR_LIMIT);

    if (!html.trim()) {
      return { error: "BR job completed but no html returned" };
    }

    return { html };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "BR fetch records failed" };
  }
}
