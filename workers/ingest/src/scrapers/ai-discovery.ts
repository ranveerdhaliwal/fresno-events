import type { EventCategory, NormalizedEvent, ScrapeContext, ScrapeError, ScrapeResult } from "@fresno-events/shared";

import { discoverEventsFromHtml } from "@/ai";
import type { IngestEnv } from "@/env";

const FETCH_TIMEOUT_MS = 12_000;
const MAX_HTML_BYTES = 1_500_000;
const ALLOWED_CATEGORIES = new Set<EventCategory>([
  "music",
  "comedy",
  "theater",
  "sports",
  "food_drink",
  "festival",
  "family",
  "art",
  "nightlife",
  "community",
  "outdoor",
  "wellness",
  "education"
]);

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

    if (!env.AI && !env.ANTHROPIC_API_KEY) {
      return result(ctx, [], [
        {
          source: "ai-discovery",
          message: "Neither the Workers AI binding nor ANTHROPIC_API_KEY is configured.",
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
        const normalized = toNormalizedEvent(item, entry.url);
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

function toNormalizedEvent(item: { title: string; startTs: string; venueName: string; venueAddress?: string; venueCity?: string; category?: string; descriptionText?: string; ticketUrl?: string; externalUrl?: string; imageUrl?: string; priceMin?: number; priceMax?: number; }, sourceUrl: string): NormalizedEvent | null {
  if (!item.title.trim() || !item.venueName.trim() || !item.startTs) {
    return null;
  }

  const start = new Date(item.startTs);
  if (Number.isNaN(start.getTime())) {
    return null;
  }

  const category = ALLOWED_CATEGORIES.has(item.category as EventCategory) ? (item.category as EventCategory) : "community";
  const sourceEventId = `ai:${hashSync(`${item.title}|${item.venueName}|${start.toISOString()}|${sourceUrl}`)}`;

  return {
    source: "manual",
    sourceEventId,
    title: item.title.trim(),
    venueName: item.venueName.trim(),
    startTs: start.toISOString(),
    timezone: "America/Los_Angeles",
    category,
    subcategories: [],
    tags: ["ai-discovery"],
    currency: "USD",
    ...(item.descriptionText ? { descriptionText: item.descriptionText } : {}),
    ...(item.venueAddress ? { venueAddress: item.venueAddress } : {}),
    ...(item.venueCity ? { venueCity: item.venueCity } : { venueCity: "Fresno" }),
    ...(typeof item.priceMin === "number" ? { priceMin: item.priceMin } : {}),
    ...(typeof item.priceMax === "number" ? { priceMax: item.priceMax } : {}),
    externalUrl: item.externalUrl ?? sourceUrl,
    ...(item.ticketUrl ? { ticketUrl: item.ticketUrl } : {}),
    ...(item.imageUrl ? { imageUrl: item.imageUrl } : {})
  };
}

/**
 * Lightweight, deterministic 32-bit FNV-1a hash converted to base36. Good enough
 * to distinguish AI-discovered candidates without requiring async crypto.
 */
function hashSync(value: string) {
  let hash = 0x811c9dc5;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = (hash + ((hash << 1) + (hash << 4) + (hash << 7) + (hash << 8) + (hash << 24))) >>> 0;
  }
  return hash.toString(36);
}
