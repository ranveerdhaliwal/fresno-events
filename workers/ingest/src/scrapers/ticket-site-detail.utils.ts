import type { NormalizedEvent } from "@fresno-events/shared";

import { sleep } from "@/lib/sleep";

import {
  isTicketSauceUrl,
  mergeTicketSauceDetail,
  parseTicketSauceTicketsPage,
  resolveTicketSauceTicketsUrl,
  resolveTicketSauceUrlFromEvent,
  type TicketSauceDetailFields
} from "./ticketsauce-detail.utils";

export type TicketSiteHost = "ticketsauce";

export interface TicketSiteDetailFields {
  priceMin?: number;
  priceMax?: number;
  ticketUrl?: string;
  priceIncludesFees?: boolean;
}

export interface TicketSiteFetchOptions {
  userAgent: string;
  signal?: AbortSignal;
  fetchImpl?: typeof fetch;
}

const FETCH_RETRIES = 1;
const RETRY_BASE_MS = 800;
const DEFAULT_TICKET_SITE_DELAY_MS = 600;

export function resolveTicketSiteHost(url: string): TicketSiteHost | null {
  if (isTicketSauceUrl(url)) {
    return "ticketsauce";
  }
  return null;
}

export function resolveTicketSiteUrlFromEvent(
  event: NormalizedEvent
): { host: TicketSiteHost; url: string } | null {
  const ticketsauceUrl = resolveTicketSauceUrlFromEvent(event);
  if (ticketsauceUrl) {
    return { host: "ticketsauce", url: ticketsauceUrl };
  }
  return null;
}

export function resolveTicketSiteTicketsPageUrl(host: TicketSiteHost, url: string): string | null {
  if (host === "ticketsauce") {
    return resolveTicketSauceTicketsUrl(url);
  }
  return null;
}

export function parseTicketSiteTicketsPage(
  host: TicketSiteHost,
  html: string,
  ticketsUrl: string
): TicketSiteDetailFields | null {
  if (host === "ticketsauce") {
    return parseTicketSauceTicketsPage(html, ticketsUrl);
  }
  return null;
}

export function mergeTicketSiteDetail(
  listing: NormalizedEvent,
  host: TicketSiteHost,
  detail: TicketSiteDetailFields
): NormalizedEvent {
  if (host === "ticketsauce") {
    return mergeTicketSauceDetail(listing, detail as TicketSauceDetailFields);
  }
  return listing;
}

async function fetchTicketSiteHtml(
  url: string,
  options: TicketSiteFetchOptions
): Promise<string> {
  const fetchFn = options.fetchImpl ?? fetch;
  let lastError: Error = new Error(`Failed fetching ${url}`);

  for (let attempt = 0; attempt <= FETCH_RETRIES; attempt += 1) {
    if (options.signal?.aborted) {
      throw new DOMException("Aborted", "AbortError");
    }

    try {
      const response = await fetchFn(url, {
        headers: {
          "User-Agent": options.userAgent,
          Accept: "text/html,application/xhtml+xml",
          "Accept-Language": "en-US,en;q=0.9"
        },
        ...(options.signal ? { signal: options.signal } : {})
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      return await response.text();
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") {
        throw error;
      }
      lastError = error instanceof Error ? error : new Error(String(error));
      if (attempt < FETCH_RETRIES) {
        await sleep(RETRY_BASE_MS * (attempt + 1));
      }
    }
  }

  throw lastError;
}

/** Fetch `/tickets` page and merge buyer-facing fields when a supported host is present. */
export async function fetchAndMergeTicketSiteDetail(
  event: NormalizedEvent,
  options: TicketSiteFetchOptions
): Promise<NormalizedEvent> {
  const resolved = resolveTicketSiteUrlFromEvent(event);
  if (!resolved) {
    return event;
  }

  const ticketsUrl = resolveTicketSiteTicketsPageUrl(resolved.host, resolved.url);
  if (!ticketsUrl) {
    return event;
  }

  try {
    const html = await fetchTicketSiteHtml(ticketsUrl, options);
    const detail = parseTicketSiteTicketsPage(resolved.host, html, ticketsUrl);
    if (!detail) {
      return event;
    }
    return mergeTicketSiteDetail(event, resolved.host, detail);
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      throw error;
    }
    console.log(
      JSON.stringify({
        event: "ticket_site_detail_failed",
        host: resolved.host,
        url: ticketsUrl,
        message: error instanceof Error ? error.message : String(error)
      })
    );
    return event;
  }
}

export async function enrichEventWithTicketSiteDetail(
  event: NormalizedEvent,
  userAgent: string,
  opts: { signal?: AbortSignal; delayMs?: number } = {}
): Promise<NormalizedEvent> {
  const resolved = resolveTicketSiteUrlFromEvent(event);
  if (!resolved) {
    return event;
  }

  const ticketsUrl = resolveTicketSiteTicketsPageUrl(resolved.host, resolved.url);
  if (!ticketsUrl) {
    return event;
  }

  const enriched = await fetchAndMergeTicketSiteDetail(event, {
    userAgent,
    ...(opts.signal ? { signal: opts.signal } : {})
  });

  const delayMs = opts.delayMs ?? DEFAULT_TICKET_SITE_DELAY_MS;
  if (delayMs > 0) {
    await sleep(delayMs);
  }

  return enriched;
}
