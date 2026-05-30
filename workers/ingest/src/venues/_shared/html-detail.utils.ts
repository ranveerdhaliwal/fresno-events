import { load } from "cheerio";

import type { AiDiscoveryItem } from "@/ai";

function readJsonLdEvent($: ReturnType<typeof load>): AiDiscoveryItem | null {
  const scripts = $('script[type="application/ld+json"]');
  for (const el of scripts.toArray()) {
    const raw = $(el).html()?.trim();
    if (!raw) continue;
    try {
      const parsed = JSON.parse(raw) as unknown;
      const nodes = Array.isArray(parsed) ? parsed : [parsed];
      for (const node of nodes) {
        if (!node || typeof node !== "object") continue;
        const record = node as Record<string, unknown>;
        const type = String(record["@type"] ?? "");
        if (!type.toLowerCase().includes("event")) continue;
        const title = typeof record.name === "string" ? record.name.trim() : "";
        const startTs =
          typeof record.startDate === "string"
            ? record.startDate
            : typeof record.startDate === "object" && record.startDate
              ? String((record.startDate as { "@value"?: string })["@value"] ?? "")
              : "";
        const descriptionText =
          typeof record.description === "string" ? record.description.trim() : undefined;
        const location = record.location;
        let venueName = "";
        if (location && typeof location === "object") {
          const loc = location as Record<string, unknown>;
          venueName = typeof loc.name === "string" ? loc.name.trim() : "";
        }
        if (!title || !startTs) continue;
        return {
          title,
          venueName: venueName || "Fresno",
          startTs,
          ...(descriptionText ? { descriptionText } : {})
        };
      }
    } catch {
      /* try next script */
    }
  }
  return null;
}

/** Best-effort SSR detail parse (no LLM). */
export function parsePlainHtmlDetailPage(
  html: string,
  pageUrl: string,
  fallbackVenue: string
): AiDiscoveryItem | null {
  const $ = load(html);
  const fromLd = readJsonLdEvent($);
  if (fromLd?.title && fromLd.startTs) {
    return fromLd;
  }

  const title =
    $('meta[property="og:title"]').attr("content")?.trim() ||
    $("h1").first().text().trim() ||
    $("title").text().trim();
  const descriptionText =
    $('meta[property="og:description"]').attr("content")?.trim() ||
    $('meta[name="description"]').attr("content")?.trim() ||
    $("article").first().text().trim().slice(0, 4000) ||
    undefined;

  const timeMeta =
    $('meta[property="event:start_time"]').attr("content")?.trim() ||
    $('time[datetime]').first().attr("datetime")?.trim();

  if (!title) {
    return null;
  }

  const startTs = timeMeta ? new Date(timeMeta).toISOString() : new Date().toISOString();
  if (Number.isNaN(new Date(startTs).getTime())) {
    return null;
  }

  return {
    title,
    venueName: fallbackVenue,
    startTs,
    externalUrl: pageUrl,
    ...(descriptionText ? { descriptionText } : {})
  };
}
