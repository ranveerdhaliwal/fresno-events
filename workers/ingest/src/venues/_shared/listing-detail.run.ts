import type { NormalizedEvent, ScrapeError } from "@fresno-events/shared";

import { extractEventsFromMarkdown, type ExtractorVariant } from "@/ai/extractor";
import { renderUrlToMarkdown } from "@/browser-rendering/render-page";
import type { IngestEnv } from "@/env";
import { getJsonPromptBackend } from "@/llm/registry";
import type { VenueConfig, VenueRunContext, VenueRunResult } from "@/venues/venue.types";

import {
  discoverDetailUrlsFromListingMarkdown,
  discoverSaveMartDetailUrlsFromMarkdown
} from "./link-discover.utils";
import {
  enrichListingsWithDetails,
  fetchListingHtml,
  hostAllowed,
  listingFromDiscoveryItem,
  resolveDetailCap,
  resolveLlmCap
} from "./listing-detail.utils";
import { buildSaveMartMonthListingUrls } from "./month-windows.utils";

export type DiscoverDetailUrlsFn = (html: string, listingUrl: string, config: VenueConfig) => string[];

function seedUrlForConfig(config: VenueConfig): string {
  if (config.sourceHostname) {
    return `https://${config.sourceHostname.replace(/^www\./, "")}/`;
  }
  return config.listingUrl;
}

function throwIfAborted(signal: AbortSignal | undefined) {
  if (signal?.aborted) {
    throw new DOMException("Ingest aborted", "AbortError");
  }
}

function canEnrichDetails(env: IngestEnv): boolean {
  const hasBr =
    Boolean(env.CLOUDFLARE_ACCOUNT_ID?.trim()) && Boolean(env.CLOUDFLARE_API_TOKEN?.trim());
  const hasLlm = Boolean(getJsonPromptBackend(env, "discovery"));
  return hasBr && hasLlm;
}

function resolveListingUrls(config: VenueConfig, now: Date): string[] {
  if (config.strategy === "month_windows_then_detail") {
    const months = config.monthWindows ?? 6;
    return buildSaveMartMonthListingUrls(config.listingUrl, months, now);
  }
  return [config.listingUrl];
}

function indexListingsByExternalUrl(listings: NormalizedEvent[]): Map<string, NormalizedEvent> {
  const map = new Map<string, NormalizedEvent>();
  for (const event of listings) {
    if (event.externalUrl?.startsWith("http")) {
      map.set(event.externalUrl.replace(/\/+$/, ""), event);
      map.set(event.externalUrl.replace(/\/+$/, "") + "/", event);
    }
  }
  return map;
}

export async function runListingThenDetailPipeline(
  env: IngestEnv,
  config: VenueConfig,
  ctx: VenueRunContext,
  discoverDetailUrls: DiscoverDetailUrlsFn
): Promise<VenueRunResult> {
  const sourceKey = `venue-ingest:${config.key}`;
  const dryRun = ctx.dryRun;
  const now = new Date();
  const listingUrls = resolveListingUrls(config, now);
  const detailCap = resolveDetailCap(config);
  const llmState = { count: 0, cap: resolveLlmCap(config) };
  const errors: ScrapeError[] = [];
  const allDetailUrls = new Set<string>();
  const useBrListing =
    config.strategy === "month_windows_then_detail" ||
    config.strategy === "scroll_listing_then_detail";
  const seedUrl = seedUrlForConfig(config);
  const variant: ExtractorVariant = config.extractorVariant ?? "default";
  let listingUrlsFound = 0;

  const log = (payload: Record<string, unknown>) =>
    console.log(JSON.stringify({ event: "venue_ingest", venue_key: config.key, ...payload }));

  for (const listingUrl of listingUrls) {
    throwIfAborted(ctx.signal);
    listingUrlsFound += 1;

    if (useBrListing) {
      if (dryRun) {
        try {
          const html = await fetchListingHtml(listingUrl, ctx.userAgent, ctx.signal);
          for (const url of discoverDetailUrls(html, listingUrl, config)) {
            if (hostAllowed(url, config)) {
              allDetailUrls.add(url);
            }
          }
        } catch (error) {
          errors.push({
            source: sourceKey,
            url: listingUrl,
            message: error instanceof Error ? error.message : "listing fetch failed",
            recoverable: true
          });
        }
        log({ step: "listing_plan", listingUrl, render: "br_markdown" });
        continue;
      }

      const rendered = await renderUrlToMarkdown(
        env,
        listingUrl,
        ctx.signal ? { signal: ctx.signal } : {}
      );
      if ("error" in rendered) {
        errors.push({
          source: sourceKey,
          url: listingUrl,
          message: rendered.error,
          recoverable: true
        });
        continue;
      }

      for (const url of discoverDetailUrlsFromListingMarkdown(rendered.markdown, listingUrl, config)) {
        if (hostAllowed(url, config)) {
          allDetailUrls.add(url);
        }
      }

      if (llmState.count < llmState.cap) {
        try {
          const extracted = await extractEventsFromMarkdown(env, {
            url: listingUrl,
            label: config.label,
            markdown: rendered.markdown,
            variant
          });
          llmState.count += 1;
          log({ step: "listing_llm_done", listingUrl, rawCount: extracted.length });
        } catch (error) {
          errors.push({
            source: sourceKey,
            url: listingUrl,
            message: error instanceof Error ? error.message : "listing LLM failed",
            recoverable: true
          });
        }
      }
    } else {
      let html = "";
      try {
        html = await fetchListingHtml(listingUrl, ctx.userAgent, ctx.signal);
      } catch (error) {
        errors.push({
          source: sourceKey,
          url: listingUrl,
          message: error instanceof Error ? error.message : "listing fetch failed",
          recoverable: true
        });
        continue;
      }

      for (const url of discoverDetailUrls(html, listingUrl, config)) {
        if (hostAllowed(url, config)) {
          allDetailUrls.add(url);
        }
      }
    }
  }

  const detailUrls = [...allDetailUrls].slice(0, detailCap);

  if (dryRun) {
    log({
      step: "dry_run_plan",
      listingUrls,
      detailUrlCount: detailUrls.length,
      detailUrlsPlanned: allDetailUrls.size
    });
    return {
      events: [],
      errors,
      listingUrlsFound,
      detailUrlsVisited: 0,
      llmCalls: llmState.count,
      debug: {
        listingUrls,
        detailUrls,
        detailUrlsPlanned: allDetailUrls.size,
        note: "dry-run — no detail BR jobs"
      }
    };
  }

  if (!canEnrichDetails(env)) {
    log({ step: "detail_skip", reason: "BR or LLM not configured" });
    return {
      events: [],
      errors: [
        ...errors,
        {
          source: sourceKey,
          message: "BR or LLM not configured — cannot enrich listing/detail pages.",
          recoverable: true
        }
      ],
      listingUrlsFound,
      detailUrlsVisited: 0,
      llmCalls: llmState.count,
      debug: { listingUrls, detailUrls, note: "listing-only — missing BR/LLM" }
    };
  }

  const listings: NormalizedEvent[] = [];

  for (const listingUrl of listingUrls) {
    throwIfAborted(ctx.signal);

    if (useBrListing) {
      const rendered = await renderUrlToMarkdown(
        env,
        listingUrl,
        ctx.signal ? { signal: ctx.signal } : {}
      );
      if ("error" in rendered) {
        continue;
      }

      if (llmState.count >= llmState.cap) {
        break;
      }

      try {
        const extracted = await extractEventsFromMarkdown(env, {
          url: listingUrl,
          label: config.label,
          markdown: rendered.markdown,
          variant
        });
        llmState.count += 1;

        for (const item of extracted) {
          const normalized = listingFromDiscoveryItem(item, listingUrl, config);
          if (normalized) {
            listings.push(normalized);
          }
        }
      } catch (error) {
        errors.push({
          source: sourceKey,
          url: listingUrl,
          message: error instanceof Error ? error.message : "listing LLM failed",
          recoverable: true
        });
      }

      for (const url of discoverDetailUrlsFromListingMarkdown(rendered.markdown, listingUrl, config)) {
        if (!hostAllowed(url, config)) {
          continue;
        }
        const key = url.replace(/\/+$/, "");
        if (!indexListingsByExternalUrl(listings).has(key) && !indexListingsByExternalUrl(listings).has(`${key}/`)) {
          const slug = new URL(url).pathname.split("/").filter(Boolean).pop() ?? "event";
          listings.push({
            source: `scrape:${config.sourceHostname?.replace(/^www\./, "") ?? new URL(seedUrl).hostname.replace(/^www\./, "")}`,
            sourceEventId: `venue:${config.key}:${slug}`,
            title: slug.replace(/-/g, " "),
            venueName: config.label,
            venueCity: "Fresno",
            startTs: new Date(now.getTime() + 7 * 86_400_000).toISOString(),
            externalUrl: url,
            category: "community"
          });
        }
      }
    } else {
      const rendered = await renderUrlToMarkdown(
        env,
        listingUrl,
        ctx.signal ? { signal: ctx.signal } : {}
      );
      if ("error" in rendered) {
        errors.push({
          source: sourceKey,
          url: listingUrl,
          message: rendered.error,
          recoverable: true
        });
        continue;
      }

      if (llmState.count >= llmState.cap) {
        break;
      }

      try {
        const extracted = await extractEventsFromMarkdown(env, {
          url: listingUrl,
          label: config.label,
          markdown: rendered.markdown,
          variant
        });
        llmState.count += 1;

        for (const item of extracted) {
          const pageUrl = item.externalUrl?.startsWith("http") ? item.externalUrl : listingUrl;
          const normalized = listingFromDiscoveryItem(item, pageUrl, config);
          if (normalized) {
            listings.push(normalized);
          }
        }
      } catch (error) {
        errors.push({
          source: sourceKey,
          url: listingUrl,
          message: error instanceof Error ? error.message : "listing LLM failed",
          recoverable: true
        });
      }
    }
  }

  const byUrl = indexListingsByExternalUrl(listings);
  for (const url of detailUrls) {
    const key = url.replace(/\/+$/, "");
    if (!byUrl.has(key) && !byUrl.has(`${key}/`)) {
      const slug = new URL(url).pathname.split("/").filter(Boolean).pop() ?? "event";
      listings.push({
        source: `scrape:${config.sourceHostname?.replace(/^www\./, "") ?? new URL(seedUrl).hostname.replace(/^www\./, "")}`,
        sourceEventId: `venue:${config.key}:${slug}`,
        title: slug.replace(/-/g, " "),
        venueName: config.label,
        venueCity: "Fresno",
        startTs: new Date(now.getTime() + 7 * 86_400_000).toISOString(),
        externalUrl: url,
        category: "community"
      });
    }
  }

  log({ step: "detail_enrich_start", listingCount: listings.length, detailUrlCount: detailUrls.length });

  const enriched = await enrichListingsWithDetails({
    env,
    config,
    listings,
    detailUrls,
    userAgent: ctx.userAgent,
    dryRun: false,
    llmState,
    sourceKey,
    ...(ctx.signal ? { signal: ctx.signal } : {})
  });

  return {
    events: enriched.events,
    errors: [...errors, ...enriched.errors],
    listingUrlsFound,
    detailUrlsVisited: enriched.detailUrlsVisited,
    llmCalls: enriched.llmCalls,
    debug: {
      listingUrls,
      detailUrls,
      detailUrlsPlanned: allDetailUrls.size,
      llmCalls: enriched.llmCalls
    }
  };
}
