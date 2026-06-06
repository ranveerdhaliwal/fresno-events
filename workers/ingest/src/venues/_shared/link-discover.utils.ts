import { load } from "cheerio";

import type { VenueConfig } from "@/venues/venue.types";
import { absoluteUrl, hostAllowed } from "./listing-detail.utils";

const TOWER_EVENT_PATH = /^\/e\/[^/]+\/?$/i;
const SAVE_MART_EVENT_PATH = /^\/event\/[^/]+\/\d+\/?$/i;

export function discoverTowerDetailUrls(html: string, listingUrl: string, _config: VenueConfig): string[] {
  const $ = load(html);
  const seen = new Set<string>();
  const ordered: string[] = [];

  $("a[href]").each((_, el) => {
    const href = $(el).attr("href")?.trim();
    if (!href) {
      return;
    }
    const abs = absoluteUrl(href, listingUrl);
    if (!abs) {
      return;
    }
    try {
      const path = new URL(abs).pathname;
      if (!TOWER_EVENT_PATH.test(path)) {
        return;
      }
      const normalized = abs.replace(/\/+$/, "");
      if (seen.has(normalized)) {
        return;
      }
      seen.add(normalized);
      ordered.push(normalized);
    } catch {
      /* ignore bad URLs */
    }
  });

  return ordered;
}

export function discoverSaveMartDetailUrls(html: string, listingUrl: string, _config: VenueConfig): string[] {
  const fromHtml = discoverSaveMartDetailUrlsFromHtml(html, listingUrl);
  return fromHtml;
}

export function discoverSaveMartDetailUrlsFromHtml(html: string, listingUrl: string): string[] {
  const $ = load(html);
  const urls = new Set<string>();

  $("a[href]").each((_, el) => {
    const href = $(el).attr("href")?.trim();
    if (!href) {
      return;
    }
    const abs = absoluteUrl(href, listingUrl);
    if (!abs) {
      return;
    }
    try {
      const path = new URL(abs).pathname;
      if (SAVE_MART_EVENT_PATH.test(path)) {
        urls.add(abs.replace(/\/+$/, "") + "/");
      }
    } catch {
      /* ignore */
    }
  });

  return [...urls];
}

/** Fallback when listing HTML is only available as BR markdown (Save Mart SPA). */
const STRUMMERS_SHOW_PATH = /^\/shows\/\d{4}\/\d{1,2}\/\d{1,2}\/[^/]+\/?$/i;

export function discoverConventionCenterDetailUrls(
  html: string,
  listingUrl: string,
  _config: VenueConfig
): string[] {
  const $ = load(html);
  const origin = new URL(listingUrl).origin;
  const urls = new Set<string>();

  $("a[href]").each((_, el) => {
    const href = $(el).attr("href")?.trim();
    if (!href) return;
    const abs = absoluteUrl(href, listingUrl);
    if (!abs) return;
    try {
      const u = new URL(abs);
      if (u.origin !== origin) return;
      if (u.pathname === "/" || u.pathname.length < 3) return;
      if (/\.(jpg|png|pdf)$/i.test(u.pathname)) return;
      urls.add(abs.replace(/\/+$/, ""));
    } catch {
      /* ignore */
    }
  });

  return [...urls];
}

/** Strummers listing links include `?format=ical` feeds — same show as the canonical page URL. */
export function canonicalStrummersShowUrl(abs: string): string | null {
  try {
    const u = new URL(abs);
    if (!STRUMMERS_SHOW_PATH.test(u.pathname)) {
      return null;
    }
    u.search = "";
    u.hash = "";
    return u.href.replace(/\/+$/, "");
  } catch {
    return null;
  }
}

export function discoverStrummersDetailUrls(html: string, listingUrl: string, _config: VenueConfig): string[] {
  const $ = load(html);
  const urls = new Set<string>();

  $("a[href]").each((_, el) => {
    const href = $(el).attr("href")?.trim();
    if (!href) return;
    const abs = absoluteUrl(href, listingUrl);
    if (!abs) return;
    const canonical = canonicalStrummersShowUrl(abs);
    if (canonical) {
      urls.add(canonical);
    }
  });

  return [...urls];
}

export function discoverFultonDetailUrls(html: string, listingUrl: string, config: VenueConfig): string[] {
  const $ = load(html);
  const urls = new Set<string>();

  $("a[href]").each((_, el) => {
    const href = $(el).attr("href")?.trim();
    if (!href) return;
    const abs = absoluteUrl(href, listingUrl);
    if (!abs) return;
    if (!hostAllowed(abs, config)) {
      return;
    }
    try {
      const host = new URL(abs).hostname.toLowerCase();
      if (host.includes("eventbrite")) {
        return;
      }
    } catch {
      return;
    }
    urls.add(abs.replace(/\/+$/, ""));
  });

  return [...urls];
}

export function discoverChaffeeDetailUrls(html: string, listingUrl: string, config: VenueConfig): string[] {
  const $ = load(html);
  const urls = new Set<string>();

  $("a[href]").each((_, el) => {
    const href = $(el).attr("href")?.trim();
    if (!href) return;
    const abs = absoluteUrl(href, listingUrl);
    if (!abs) return;
    const linkText = $(el).text();
    const isTicketLink = /get\s*tickets/i.test(linkText) || abs.includes("ticketapp.org");
    let isEventPath = false;
    try {
      const u = new URL(abs);
      isEventPath = u.hostname.includes("fcz.org") && u.pathname.includes("/events/");
    } catch {
      /* ignore */
    }
    if (!isTicketLink && !isEventPath) return;
    if (hostAllowed(abs, config) || abs.includes("ticketapp.org")) {
      urls.add(abs.replace(/\/+$/, ""));
    }
  });

  return [...urls];
}

export function discoverRainbowDetailUrlsFromMarkdown(markdown: string, listingUrl: string): string[] {
  const urls = new Set<string>();
  const re = /https?:\/\/[^\s)"']*eventmania\.com[^\s)"']*/gi;
  for (const match of markdown.matchAll(re)) {
    urls.add(match[0].replace(/\/+$/, ""));
  }
  return [...urls];
}

export function discoverRainbowDetailUrls(html: string, listingUrl: string, config: VenueConfig): string[] {
  const fromHtml = discoverFultonDetailUrls(html, listingUrl, {
    ...config,
    allowedExternalHosts: [...(config.allowedExternalHosts ?? []), "eventmania.com", "www.eventmania.com"]
  });
  return fromHtml.filter((u) => u.includes("eventmania.com"));
}

export function discoverFairDetailUrls(html: string, listingUrl: string, _config: VenueConfig): string[] {
  const $ = load(html);
  const origin = new URL(listingUrl).origin;
  const urls = new Set<string>();

  $("a[href]").each((_, el) => {
    const href = $(el).attr("href")?.trim();
    if (!href) return;
    const abs = absoluteUrl(href, listingUrl);
    if (!abs) return;
    try {
      const path = new URL(abs).pathname;
      if (path.includes("/events/") && path.length > 10) {
        urls.add(abs.replace(/\/+$/, ""));
      }
    } catch {
      /* ignore */
    }
  });

  return [...urls];
}

export function discoverFairDetailUrlsFromMarkdown(markdown: string, listingUrl: string): string[] {
  const origin = new URL(listingUrl).origin;
  const urls = new Set<string>();
  const re = /(?:https?:\/\/[^\s)"']+)?\/events\/[^\s)"']+/gi;
  for (const match of markdown.matchAll(re)) {
    const raw = match[0].startsWith("http") ? match[0] : `${origin}${match[0]}`;
    try {
      urls.add(new URL(raw, origin).href.replace(/\/+$/, ""));
    } catch {
      /* ignore */
    }
  }
  return [...urls];
}

export function discoverDetailUrlsFromListingMarkdown(
  markdown: string,
  listingUrl: string,
  config: VenueConfig
): string[] {
  if (config.key === "rainbow-ballroom") {
    return discoverRainbowDetailUrlsFromMarkdown(markdown, listingUrl);
  }
  if (config.key === "big-fresno-fair") {
    return discoverFairDetailUrlsFromMarkdown(markdown, listingUrl);
  }
  return discoverSaveMartDetailUrlsFromMarkdown(markdown, listingUrl);
}

export function discoverSaveMartDetailUrlsFromMarkdown(markdown: string, listingUrl: string): string[] {
  const urls = new Set<string>();
  const origin = new URL(listingUrl).origin;
  const re = /(?:https?:\/\/[^\s)"']+)?\/event\/[^\s)"']+\/\d+\/?/gi;

  for (const match of markdown.matchAll(re)) {
    const raw = match[0].startsWith("http") ? match[0] : `${origin}${match[0]}`;
    try {
      const path = new URL(raw, origin).pathname;
      if (SAVE_MART_EVENT_PATH.test(path)) {
        urls.add(new URL(raw, origin).href.replace(/\/+$/, "") + "/");
      }
    } catch {
      /* ignore */
    }
  }

  return [...urls];
}
