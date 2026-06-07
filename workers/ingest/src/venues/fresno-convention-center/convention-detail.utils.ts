import type { AiDiscoveryItem } from "@/ai";
import { load } from "cheerio";

import { instantFromPacificLocal } from "@/lib/pacific-instant.utils";

const MONTH: Record<string, number> = {
  january: 1,
  february: 2,
  march: 3,
  april: 4,
  may: 5,
  june: 6,
  july: 7,
  august: 8,
  september: 9,
  october: 10,
  november: 11,
  december: 12,
  jan: 1,
  feb: 2,
  mar: 3,
  apr: 4,
  jun: 6,
  jul: 7,
  aug: 8,
  sep: 9,
  sept: 9,
  oct: 10,
  nov: 11,
  dec: 12
};

function parseShowTime12hr(raw: string): string | null {
  const match = raw.trim().match(/^(\d{1,2})(?::(\d{2}))?\s*(AM|PM)$/i);
  if (!match?.[1] || !match[3]) {
    return null;
  }
  let hour = Number(match[1]);
  const minute = match[2] ? Number(match[2]) : 0;
  const meridiem = match[3].toUpperCase();
  if (meridiem === "PM" && hour < 12) {
    hour += 12;
  }
  if (meridiem === "AM" && hour === 12) {
    hour = 0;
  }
  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

/** e.g. "FRI - OCT 2, 2026 - 8 PM" or "SAT, May 23, 2026 - 8PM" */
export function parseConventionDateTimeLine(line: string): { dateYmd: string; timeHHmm: string } | null {
  const match = line.match(
    /(?:MON|TUE|WED|THU|FRI|SAT|SUN)[,\s-]*([A-Za-z]+)\s+(\d{1,2}),?\s*(\d{4})\s*-\s*(\d{1,2})(?::(\d{2}))?\s*(AM|PM)/i
  );
  if (!match?.[1] || !match[2] || !match[3] || !match[4] || !match[6]) {
    return null;
  }
  const month = MONTH[match[1].toLowerCase()];
  const day = Number(match[2]);
  const year = Number(match[3]);
  if (!month || day < 1 || day > 31) {
    return null;
  }
  const timeHHmm = parseShowTime12hr(`${match[4]}:${match[5] ?? "00"} ${match[6]}`);
  if (!timeHHmm) {
    return null;
  }
  const dateYmd = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  return { dateYmd, timeHHmm };
}

function pickTicketUrl($: ReturnType<typeof load>): string | undefined {
  let ticketUrl: string | undefined;
  $("a[href]").each((_, el) => {
    if (ticketUrl) {
      return;
    }
    const href = $(el).attr("href")?.trim();
    if (!href?.startsWith("http")) {
      return;
    }
    const text = $(el).text().replace(/\s+/g, " ").trim().toLowerCase();
    const lower = href.toLowerCase();
    if (
      text.includes("purchase ticket") ||
      lower.includes("ticketmaster") ||
      lower.includes("atgtickets") ||
      lower.includes("queue.atgtickets")
    ) {
      ticketUrl = href;
    }
  });
  return ticketUrl;
}

function pickDescription($: ReturnType<typeof load>, ogDescription: string | undefined): string | undefined {
  if (ogDescription && ogDescription.length >= 40) {
    return ogDescription;
  }
  const chunks: string[] = [];
  $("p").each((_, el) => {
    const text = $(el).text().replace(/\s+/g, " ").trim();
    if (text.length < 40) {
      return;
    }
    const lower = text.toLowerCase();
    if (
      lower.includes("first name") ||
      lower.includes("email address") ||
      lower.includes("phone number") ||
      lower.includes("preferred seating")
    ) {
      return;
    }
    chunks.push(text);
  });
  const joined = chunks.join("\n\n").trim();
  return joined.length > 0 ? joined.slice(0, 4000) : ogDescription;
}

/** SSR detail pages on events.fresnoconventioncenter.com */
export function parseConventionDetailPage(html: string, pageUrl: string): AiDiscoveryItem | null {
  const $ = load(html);
  const title =
    $('meta[property="og:title"]').attr("content")?.trim() ||
    $("h1").first().text().replace(/\s+/g, " ").trim();
  if (!title) {
    return null;
  }

  const dateLine =
    $("h2")
      .toArray()
      .map((el) => $(el).text().replace(/\s+/g, " ").trim())
      .find((line) => /(?:MON|TUE|WED|THU|FRI|SAT|SUN)/i.test(line) && /\d{4}/.test(line)) ?? "";

  const parsedWhen = dateLine ? parseConventionDateTimeLine(dateLine) : null;
  const startTs = parsedWhen ? instantFromPacificLocal(parsedWhen.dateYmd, parsedWhen.timeHHmm) : null;
  if (!startTs) {
    return null;
  }

  const venueName =
    $("h2")
      .toArray()
      .map((el) => $(el).text().replace(/\s+/g, " ").trim())
      .find((line) => /theatre|theater|hall|arena|center/i.test(line) && !/\d{4}/.test(line)) ?? "Fresno Convention Center";

  const ogDescription = $('meta[property="og:description"]').attr("content")?.trim();
  const descriptionText = pickDescription($, ogDescription);
  const imageUrl = $('meta[property="og:image"]').attr("content")?.trim();
  const ticketUrl = pickTicketUrl($);

  return {
    title,
    venueName,
    venueCity: "Fresno",
    startTs,
    externalUrl: pageUrl.replace(/\/+$/, ""),
    ...(descriptionText ? { descriptionText } : {}),
    ...(imageUrl ? { imageUrl } : {}),
    ...(ticketUrl ? { ticketUrl } : {})
  };
}
