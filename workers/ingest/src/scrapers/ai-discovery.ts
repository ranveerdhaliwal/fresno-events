import type { NormalizedEvent, ScrapeContext, ScrapeError, ScrapeResult } from "@fresno-events/shared";

import { discoverEventsFromHtml } from "@/ai";
import type { IngestEnv } from "@/env";
import { getJsonPromptBackend } from "@/llm/registry";
import { toNormalizedEventFromDiscovery } from "@/normalized-event";

const FETCH_TIMEOUT_MS = 12_000;
const MAX_HTML_BYTES = 1_500_000;

interface AiDiscoveryConfig {
  urls?: Array<{ url: string; label?: string }>;
  /** Max events emitted per source URL after AI extraction. */
  maxPerUrl?: number;
}

export function createAiDiscoveryRunner(env: IngestEnv) {
  return async (ctx: ScrapeContext): Promise<ScrapeResult> => {
    const started = performance.now();
    const config = (ctx.config ?? {}) as AiDiscoveryConfig;
    const urls = (config.urls ?? []).filter((entry) => typeof entry?.url === "string" && /^https?:\/\//.test(entry.url));
    const maxPerUrl = typeof config.maxPerUrl === "number" && config.maxPerUrl > 0 ? Math.min(config.maxPerUrl, 50) : 20;

    if (!getJsonPromptBackend(env, "discovery")) {
      return result(ctx, [], [
        {
          source: "ai-discovery",
          message:
            "No AI provider configured (Workers AI binding, GEMINI_API_KEY, or ANTHROPIC_API_KEY).",
          recoverable: true
        }
      ], 0, started);
    }

    if (urls.length === 0) {
      return result(ctx, [], [
        {
          source: "ai-discovery",
          message: "ai-discovery source has no `urls` in its config.",
          recoverable: true
        }
      ], 0, started);
    }

    const events: NormalizedEvent[] = [];
    const errors: ScrapeError[] = [];
    let pages = 0;

    for (const entry of urls) {
      pages += 1;
      const html = await fetchHtml(entry.url, ctx);
      if (!html) {
        errors.push({
          source: "ai-discovery",
          url: entry.url,
          message: `Failed to fetch HTML from ${entry.url}.`,
          recoverable: true
        });
        continue;
      }

      const items = await discoverEventsFromHtml(env, {
        url: entry.url,
        label: entry.label ?? entry.url,
        html
      });

      for (const item of items.slice(0, maxPerUrl)) {
        const normalized = toNormalizedEventFromDiscovery(item, entry.url, entry.url, "ai-discovery");
        if (normalized) {
          events.push(normalized);
        }
      }
    }

    return result(ctx, events, errors, pages, started);
  };
}

function result(ctx: ScrapeContext, events: NormalizedEvent[], errors: ScrapeError[], pagesVisited: number, started: number): ScrapeResult {
  return {
    source: "ai-discovery",
    runId: ctx.runId,
    events,
    errors,
    metrics: { pagesVisited, durationMs: Math.round(performance.now() - started) }
  };
}

async function fetchHtml(url: string, ctx: ScrapeContext): Promise<string | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  if (ctx.signal) {
    ctx.signal.addEventListener("abort", () => controller.abort(), { once: true });
  }

  try {
    const response = await fetch(url, {
      headers: {
        "User-Agent": ctx.userAgent,
        Accept: "text/html,application/xhtml+xml"
      },
      redirect: "follow",
      signal: controller.signal
    });

    if (!response.ok) {
      return null;
    }

    const length = Number(response.headers.get("content-length") ?? 0);
    if (length && length > MAX_HTML_BYTES) {
      return null;
    }

    const html = await response.text();
    if (html.length > MAX_HTML_BYTES) {
      return html.slice(0, MAX_HTML_BYTES);
    }
    return html;
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError" && ctx.signal?.aborted) {
      throw error;
    }
    return null;
  } finally {
    clearTimeout(timer);
  }
}

