import type { NormalizedEvent, ScrapeError } from "@fresno-events/shared";

import { extractEventsFromMarkdown } from "@/ai/extractor";
import { renderUrlToHtml, renderUrlToMarkdown } from "@/browser-rendering/render-page";
import type { IngestEnv } from "@/env";
import { getJsonPromptBackend } from "@/llm/registry";
import { buildGobulldogsPrintUrl, parseGobulldogsPrintHtml } from "@/scrapers/seed-special-url/gobulldogs.utils";
import { fetchListingHtml, listingFromDiscoveryItem } from "@/venues/_shared/listing-detail.utils";
import { runHtmlParseVenue } from "@/venues/_shared/html-parse.run";
import type { VenueConfig, VenueRunContext, VenueRunResult } from "@/venues/venue.types";

import configJson from "./venue.config.json";

const config = configJson as VenueConfig;
const sourceKey = `venue-ingest:${config.key}`;

function canUseLlmDiscovery(env: IngestEnv): boolean {
  return Boolean(getJsonPromptBackend(env, "discovery"));
}

function hasBrCredentials(env: IngestEnv): boolean {
  return Boolean(env.CLOUDFLARE_ACCOUNT_ID?.trim()) && Boolean(env.CLOUDFLARE_API_TOKEN?.trim());
}

async function fetchGobulldogsScheduleHtml(
  env: IngestEnv,
  url: string,
  ctx: VenueRunContext
): Promise<string> {
  const now = new Date();
  const plain = await fetchListingHtml(url, ctx.userAgent, ctx.signal);
  if (parseGobulldogsPrintHtml(plain, now).length > 0) {
    return plain;
  }

  const rendered = await renderUrlToHtml(env, url, ctx.signal ? { signal: ctx.signal } : {});
  if ("error" in rendered) {
    throw new Error(rendered.error);
  }

  return rendered.html;
}

async function parseGobulldogsWithFallback(
  env: IngestEnv,
  ctx: VenueRunContext
): Promise<{ events: NormalizedEvent[]; llmCalls: number; errors: ScrapeError[] }> {
  const errors: ScrapeError[] = [];
  const url = buildGobulldogsPrintUrl(new Date());
  const now = new Date();

  let html: string;
  try {
    html = await fetchGobulldogsScheduleHtml(env, url, ctx);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { events: [], llmCalls: 0, errors: [{ source: sourceKey, url, message, recoverable: true }] };
  }

  const fromHtml = parseGobulldogsPrintHtml(html, now);
  if (fromHtml.length > 0) {
    return { events: fromHtml, llmCalls: 0, errors };
  }

  if (!hasBrCredentials(env)) {
    errors.push({
      source: sourceKey,
      url,
      message: "CLOUDFLARE_ACCOUNT_ID and CLOUDFLARE_API_TOKEN required for gobulldogs (Sidearm SPA).",
      recoverable: true
    });
    return { events: [], llmCalls: 0, errors };
  }

  if (!canUseLlmDiscovery(env)) {
    errors.push({
      source: sourceKey,
      url,
      message: "GEMINI_API_KEY (or discovery LLM) required when print HTML has no schedule rows.",
      recoverable: true
    });
    return { events: [], llmCalls: 0, errors };
  }

  const rendered = await renderUrlToMarkdown(env, url, ctx.signal ? { signal: ctx.signal } : {});
  if ("error" in rendered) {
    errors.push({
      source: sourceKey,
      url,
      message: `BR schedule: ${rendered.error}`,
      recoverable: true
    });
    return { events: [], llmCalls: 0, errors };
  }

  try {
    const extracted = await extractEventsFromMarkdown(env, {
      url,
      label: config.label,
      markdown: rendered.markdown,
      variant: config.extractorVariant ?? "default"
    });
    const events: NormalizedEvent[] = [];
    for (const item of extracted) {
      const pageUrl = item.externalUrl?.startsWith("http") ? item.externalUrl : config.listingUrl;
      const normalized = listingFromDiscoveryItem(item, pageUrl, config);
      if (normalized) {
        events.push(normalized);
      }
    }
    return { events, llmCalls: 1, errors };
  } catch (error) {
    const message = error instanceof Error ? error.message : "LLM schedule extraction failed";
    errors.push({ source: sourceKey, url, message, recoverable: true });
    return { events: [], llmCalls: 0, errors };
  }
}

export async function run(env: IngestEnv, ctx: VenueRunContext): Promise<VenueRunResult> {
  if (!ctx.dryRun) {
    return runHtmlParseVenue(env, config, ctx, async (runEnv, _venueConfig, runCtx) => {
      const { events } = await parseGobulldogsWithFallback(runEnv, runCtx);
      return events;
    });
  }

  const { events, llmCalls, errors } = await parseGobulldogsWithFallback(env, ctx);
  return {
    events,
    errors,
    listingUrlsFound: 1,
    detailUrlsVisited: 0,
    llmCalls,
    debug: {
      listingUrls: [config.listingUrl],
      detailUrlsPlanned: events.length,
      note: events.length > 0 ? "dry-run — html_parse venue" : "dry-run — no schedule rows"
    }
  };
}

export { config };
