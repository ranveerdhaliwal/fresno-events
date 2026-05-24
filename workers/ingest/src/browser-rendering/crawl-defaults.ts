import { usesShallowCrawl, type ParsedCrawlHints } from "@/browser-rendering/crawl-targets.utils";
import type { IngestEnv } from "@/env";
import type { SeedUrlRow } from "@/seed-urls";
import type { BrCrawlRequestBody } from "@/browser-rendering/types";

export { usesShallowCrawl };

export const DEFAULT_REJECT_RESOURCE_TYPES = ["image", "media", "font", "stylesheet"] as const;

export const CRAWL_LIMITS = {
  MAX_PAGES_PER_SEED: 30,
  MAX_DEPTH: 3,
  SHALLOW_LIMIT: 1,
  SHALLOW_DEPTH: 0,
  MAX_LLM_CALLS_PER_RUN: 200,
  PER_SEED_POLL_TIMEOUT_MS: 8 * 60 * 1000,
  POLL_INTERVAL_MS: 5_000,
  POLL_LOG_INTERVAL_MS: 30_000,
  PER_SEED_DELAY_MS: 1_000,
  MARKDOWN_CHAR_LIMIT: 60_000
} as const;

function parsePositiveInt(value: string | undefined, fallback: number) {
  if (!value) {
    return fallback;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? Math.trunc(parsed) : fallback;
}

export function buildCrawlRequest(
  seed: SeedUrlRow,
  env: IngestEnv,
  opts: { targetUrl: string; hints: ParsedCrawlHints; isWindowUrl?: boolean }
): BrCrawlRequestBody {
  const shallow = usesShallowCrawl(opts.hints);
  const limit = shallow
    ? CRAWL_LIMITS.SHALLOW_LIMIT
    : parsePositiveInt(env.MAX_PAGES_PER_SEED, CRAWL_LIMITS.MAX_PAGES_PER_SEED);
  const depth = shallow
    ? CRAWL_LIMITS.SHALLOW_DEPTH
    : parsePositiveInt(env.MAX_CRAWL_DEPTH, CRAWL_LIMITS.MAX_DEPTH);

  return {
    url: opts.targetUrl,
    limit,
    depth,
    render: true,
    formats: ["markdown"],
    rejectResourceTypes: [...DEFAULT_REJECT_RESOURCE_TYPES],
    crawlPurposes: ["search", "ai-input"],
    options: {
      includeExternalLinks: false,
      includeSubdomains: false
    },
    ...(!opts.isWindowUrl && seed.last_successful_crawl_at
      ? { modifiedSince: Math.floor(new Date(seed.last_successful_crawl_at).getTime() / 1000) }
      : {})
  };
}
