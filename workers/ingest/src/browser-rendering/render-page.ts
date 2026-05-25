import * as brClient from "@/browser-rendering/crawl-client";
import { CRAWL_LIMITS, DEFAULT_REJECT_RESOURCE_TYPES } from "@/browser-rendering/crawl-defaults";
import type { BrCrawlRequestBody } from "@/browser-rendering/types";
import type { IngestEnv } from "@/env";

export interface RenderUrlToMarkdownOptions {
  signal?: AbortSignal;
}

function buildShallowCrawlBody(url: string): BrCrawlRequestBody {
  return {
    url,
    limit: CRAWL_LIMITS.SHALLOW_LIMIT,
    depth: CRAWL_LIMITS.SHALLOW_DEPTH,
    render: true,
    formats: ["markdown"],
    rejectResourceTypes: [...DEFAULT_REJECT_RESOURCE_TYPES],
    crawlPurposes: ["search", "ai-input"],
    options: {
      includeExternalLinks: false,
      includeSubdomains: false
    }
  };
}

function sleep(ms: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms));
}

function throwIfAborted(signal: AbortSignal | undefined) {
  if (signal?.aborted) {
    throw new DOMException("Ingest aborted", "AbortError");
  }
}

/**
 * Shallow Browser Rendering crawl (limit 1, depth 0) for a single page URL.
 */
export async function renderUrlToMarkdown(
  env: IngestEnv,
  url: string,
  opts: RenderUrlToMarkdownOptions = {}
): Promise<{ markdown: string } | { error: string }> {
  const accountId = env.CLOUDFLARE_ACCOUNT_ID?.trim();
  const token = env.CLOUDFLARE_API_TOKEN?.trim();
  if (!accountId || !token) {
    return { error: "CLOUDFLARE_ACCOUNT_ID and CLOUDFLARE_API_TOKEN are required." };
  }

  const body = buildShallowCrawlBody(url);
  let jobId: string;

  try {
    throwIfAborted(opts.signal);
    jobId = await brClient.startCrawl(env, body);
  } catch (error) {
    return { error: error instanceof Error ? error.message : "BR crawl start failed" };
  }

  const pollStarted = Date.now();
  const deadline = pollStarted + CRAWL_LIMITS.PER_SEED_POLL_TIMEOUT_MS;
  let status = "running";

  while (status === "running" && Date.now() < deadline) {
    throwIfAborted(opts.signal);
    try {
      const job = await brClient.getCrawlJob(env, jobId, { limit: 1 });
      status = job.status;
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
    return { error: `BR job ${jobId} ended with status ${status}` };
  }

  try {
    const records = await brClient.fetchAllRecords(env, jobId);
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
