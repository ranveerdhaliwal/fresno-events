import type { EventSource, NormalizedEvent, ScrapeError } from "@fresno-events/shared";

import { extractEventsFromMarkdown, type ExtractorVariant } from "@/ai/extractor";
import { buildTicketsauceRangeUrl } from "@/browser-rendering/crawl-targets.utils";
import { renderUrlToMarkdown } from "@/browser-rendering/render-page";
import type { IngestEnv } from "@/env";
import { getJsonPromptBackend } from "@/llm/registry";
import type { VenueConfig, VenueRunContext, VenueRunResult } from "@/venues/venue.types";
import { resolveDetailMode, type DetailMode } from "@/venues/venue-profile.utils";

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

function canRunDetailEnrichment(env: IngestEnv, detailMode: DetailMode, useBrListing: boolean): boolean {
  if (detailMode === "plain_html") {
    return true;
  }
  if (detailMode === "none" || detailMode === "api_embedded") {
    return true;
  }
  if (useBrListing) {
    return canEnrichDetails(env);
  }
  return canEnrichDetails(env);
}

function isTicketsauceVenue(config: VenueConfig): boolean {
  return Boolean(config.sourceHostname?.includes("ticketsauce.com"));
}

function resolveListingUrls(config: VenueConfig, now: Date): string[] {
  if (config.strategy === "month_windows_then_detail") {
    const months = config.monthWindows ?? 6;
    return buildSaveMartMonthListingUrls(config.listingUrl, months, now);
  }
  if (isTicketsauceVenue(config)) {
    return [
      buildTicketsauceRangeUrl(config.listingUrl, {
        now,
        horizonMonths: config.monthWindows ?? 6
      })
    ];
  }
  return [config.listingUrl];
}

function addDiscoveredDetailUrl(
  ordered: string[],
  seen: Set<string>,
  url: string,
  config: VenueConfig
): void {
  if (!hostAllowed(url, config)) {
    return;
  }
  const key = url.replace(/\/+$/, "");
  if (seen.has(key)) {
    return;
  }
  seen.add(key);
  ordered.push(key);
}

type VenueIngestLog = (payload: Record<string, unknown>) => void;

async function extractAndNormalizeListingFromMarkdown(
  env: IngestEnv,
  config: VenueConfig,
  listingUrl: string,
  markdown: string,
  variant: ExtractorVariant,
  opts: { useItemExternalUrl: boolean; log: VenueIngestLog }
): Promise<{ events: NormalizedEvent[]; llmCalled: boolean }> {
  const markdownChars = markdown.length;
  const hasLlm = Boolean(getJsonPromptBackend(env, "discovery"));

  opts.log({ step: "listing_br_rendered", listingUrl, markdownChars, hasLlm });

  if (!hasLlm) {
    opts.log({ step: "listing_llm_skipped", listingUrl, reason: "no_llm_backend", markdownChars });
    return { events: [], llmCalled: false };
  }
  if (markdownChars < 200) {
    opts.log({ step: "listing_llm_skipped", listingUrl, reason: "markdown_too_short", markdownChars });
    return { events: [], llmCalled: false };
  }

  const extracted = await extractEventsFromMarkdown(env, {
    url: listingUrl,
    label: config.label,
    markdown,
    variant
  });

  const events: NormalizedEvent[] = [];
  let dropped = 0;
  for (const item of extracted) {
    const pageUrl =
      opts.useItemExternalUrl && item.externalUrl?.startsWith("http") ? item.externalUrl : listingUrl;
    const normalized = listingFromDiscoveryItem(item, pageUrl, config);
    if (normalized) {
      events.push(normalized);
    } else {
      dropped += 1;
    }
  }

  opts.log({
    step: "listing_llm_done",
    listingUrl,
    markdownChars,
    rawCount: extracted.length,
    keptCount: events.length,
    droppedCount: dropped
  });

  return { events, llmCalled: true };
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
  const allDetailUrls: string[] = [];
  const seenDetailUrls = new Set<string>();
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
        const urlsBefore = allDetailUrls.length;
        try {
          const html = await fetchListingHtml(listingUrl, ctx.userAgent, ctx.signal);
          for (const url of discoverDetailUrls(html, listingUrl, config)) {
            addDiscoveredDetailUrl(allDetailUrls, seenDetailUrls, url, config);
          }
        } catch (error) {
          errors.push({
            source: sourceKey,
            url: listingUrl,
            message: error instanceof Error ? error.message : "listing fetch failed",
            recoverable: true
          });
        }

        if (allDetailUrls.length === urlsBefore) {
          const rendered = await renderUrlToMarkdown(
            env,
            listingUrl,
            ctx.signal ? { signal: ctx.signal } : {}
          );
          if ("error" in rendered) {
            errors.push({
              source: sourceKey,
              url: listingUrl,
              message: `BR listing discovery: ${rendered.error}`,
              recoverable: true
            });
            log({ step: "listing_plan_br_failed", listingUrl, error: rendered.error });
          } else {
            for (const url of discoverDetailUrlsFromListingMarkdown(
              rendered.markdown,
              listingUrl,
              config
            )) {
              addDiscoveredDetailUrl(allDetailUrls, seenDetailUrls, url, config);
            }
            log({
              step: "listing_plan_br",
              listingUrl,
              detailUrlsAdded: allDetailUrls.length - urlsBefore
            });
          }
        } else {
          log({ step: "listing_plan", listingUrl, render: "plain_fetch" });
        }
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
        addDiscoveredDetailUrl(allDetailUrls, seenDetailUrls, url, config);
      }

      if (llmState.count < llmState.cap) {
        try {
          const { llmCalled } = await extractAndNormalizeListingFromMarkdown(
            env,
            config,
            listingUrl,
            rendered.markdown,
            variant,
            { useItemExternalUrl: false, log }
          );
          if (llmCalled) {
            llmState.count += 1;
          }
        } catch (error) {
          log({
            step: "listing_llm_failed",
            listingUrl,
            message: error instanceof Error ? error.message : "listing LLM failed"
          });
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

      const discovered = discoverDetailUrls(html, listingUrl, config);
      for (const url of discovered) {
        addDiscoveredDetailUrl(allDetailUrls, seenDetailUrls, url, config);
      }
      if (dryRun && discovered.length > 0) {
        log({
          step: "listing_plan_plain",
          listingUrl,
          detailUrlsFound: discovered.length
        });
      }
    }
  }

  const detailMode = resolveDetailMode(config);
  const detailUrls =
    detailMode === "none" || detailMode === "api_embedded"
      ? []
      : allDetailUrls.filter((url) => hostAllowed(url, config)).slice(0, detailCap);

  if (dryRun) {
    log({
      step: "dry_run_plan",
      listingUrls,
      detailUrlCount: detailUrls.length,
      detailUrlsPlanned: allDetailUrls.length,
      detailUrlCap: detailCap,
      note: "dry-run — listing BR/LLM and detail fetch run on promote only"
    });
    return {
      events: [],
      errors,
      listingUrlsFound,
      detailUrlsVisited: 0,
      llmCalls: llmState.count,
      debug: {
        listingUrls,
        fetchUrls: listingUrls,
        detailUrls,
        detailUrlsPlanned: allDetailUrls.length,
        note: "dry-run — listing BR/LLM and detail fetch run on promote only"
      }
    };
  }

  if (!canRunDetailEnrichment(env, detailMode, useBrListing)) {
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
      debug: { listingUrls, fetchUrls: listingUrls, detailUrls, note: "listing-only — missing BR/LLM" }
    };
  }

  const listings: NormalizedEvent[] = [];
  const scrapeSource = `scrape:${config.sourceHostname?.replace(/^www\./, "") ?? new URL(seedUrl).hostname.replace(/^www\./, "")}` as EventSource;

  if (useBrListing) {
    for (const listingUrl of listingUrls) {
      throwIfAborted(ctx.signal);

      const rendered = await renderUrlToMarkdown(
        env,
        listingUrl,
        ctx.signal ? { signal: ctx.signal } : {}
      );
      if ("error" in rendered) {
        log({ step: "listing_br_failed", listingUrl, error: rendered.error });
        continue;
      }

      if (llmState.count >= llmState.cap) {
        break;
      }

      try {
        const { events, llmCalled } = await extractAndNormalizeListingFromMarkdown(
          env,
          config,
          listingUrl,
          rendered.markdown,
          variant,
          { useItemExternalUrl: false, log }
        );
        if (llmCalled) {
          llmState.count += 1;
        }
        listings.push(...events);
      } catch (error) {
        log({
          step: "listing_llm_failed",
          listingUrl,
          message: error instanceof Error ? error.message : "listing LLM failed"
        });
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
            source: scrapeSource,
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
    }
  } else {
    log({
      step: "listing_plain_promote",
      listingUrls,
      detailUrlsFound: detailUrls.length,
      detailMode
    });
  }

  const pushListingStub = (url: string) => {
    const key = url.replace(/\/+$/, "");
    const indexed = indexListingsByExternalUrl(listings);
    if (indexed.has(key) || indexed.has(`${key}/`)) {
      return;
    }
    const slug = new URL(url).pathname.split("/").filter(Boolean).pop() ?? "event";
    listings.push({
      source: scrapeSource,
      sourceEventId: `venue:${config.key}:${slug}`,
      title: slug.replace(/-/g, " "),
      venueName: config.label,
      venueCity: "Fresno",
      startTs: new Date(now.getTime() + 7 * 86_400_000).toISOString(),
      externalUrl: url,
      category: "community"
    });
  };

  for (const url of detailUrls) {
    pushListingStub(url);
  }

  const detailUrlKeys = new Set(detailUrls.map((u) => u.replace(/\/+$/, "")));
  let capSkipped = 0;
  for (const url of allDetailUrls) {
    const key = url.replace(/\/+$/, "");
    if (detailUrlKeys.has(key)) {
      continue;
    }
    const before = listings.length;
    pushListingStub(url);
    if (listings.length > before) {
      capSkipped += 1;
    }
  }

  if (capSkipped > 0) {
    log({
      step: "detail_cap_skipped",
      capSkipped,
      detailUrlCap: detailCap,
      detailUrlsPlanned: allDetailUrls.length
    });
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
      fetchUrls: listingUrls,
      detailUrls,
      detailUrlsPlanned: allDetailUrls.length,
      llmCalls: enriched.llmCalls
    }
  };
}
