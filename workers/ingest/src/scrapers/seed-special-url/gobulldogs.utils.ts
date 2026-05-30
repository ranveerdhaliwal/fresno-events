import type { NormalizedEvent } from "@fresno-events/shared";
import { load } from "cheerio";

export function buildGobulldogsPrintUrl(now: Date, horizonDays = 90): string {
  const end = new Date(now.getTime() + horizonDays * 86_400_000);
  const fmt = (d: Date) => `${d.getMonth() + 1}-${d.getDate()}-${d.getFullYear()}`;
  return `https://gobulldogs.com/calendar/print/month/0/${fmt(now)}/${fmt(end)}/null`;
}

function parseDateText(text: string, now: Date): string | null {
  const parsed = Date.parse(text);
  if (!Number.isNaN(parsed)) {
    return new Date(parsed).toISOString();
  }
  return null;
}

/** Parse Sidearm-style print HTML when server-rendered; SPA shells return []. */
export function parseGobulldogsPrintHtml(html: string, now: Date): NormalizedEvent[] {
  const withFootballFilter = parseGobulldogsPrintHtmlInner(html, now, true);
  if (withFootballFilter.length > 0) {
    return withFootballFilter;
  }
  return parseGobulldogsPrintHtmlInner(html, now, false);
}

function parseGobulldogsPrintHtmlInner(
  html: string,
  now: Date,
  footballOnly: boolean
): NormalizedEvent[] {
  const $ = load(html);
  const events: NormalizedEvent[] = [];

  const selectors = [
    ".sidearm-schedule-game",
    "[data-test-id*='schedule'] [data-test-id*='event']",
    ".sidearm-calendar-game",
    "[data-test-id*='sidearm-calendar']"
  ];

  for (const selector of selectors) {
    $(selector).each((_, el) => {
      const row = $(el);
      const sport = row.find(".sport, .sidearm-schedule-game-sport").first().text().trim();
      if (footballOnly && sport.length > 0 && !/football/i.test(sport)) {
        return;
      }

      const title =
        row.find(".sidearm-schedule-game-opponent, .opponent, .title, h3, h4").first().text().trim() ||
        row.attr("aria-label")?.trim() ||
        row.text().trim().slice(0, 120);
      const dateText =
        row.find(".sidearm-schedule-game-date-time, .date, time").first().text().trim() ||
        row.attr("data-date") ||
        row.find("time").attr("datetime") ||
        "";
      const location =
        row.find(".sidearm-schedule-game-location, .location, .venue").first().text().trim() ||
        "Fresno State";

      const startTs = parseDateText(dateText, now);
      if (!title || !startTs) {
        return;
      }

      events.push({
        source: "scrape:gobulldogs.com",
        sourceEventId: `gobulldogs:${title}:${startTs.slice(0, 10)}`,
        title,
        venueName: location,
        venueCity: "Fresno",
        startTs,
        category: "sports",
        externalUrl: "https://gobulldogs.com/calendar"
      });
    });

    if (events.length > 0) {
      break;
    }
  }

  return events;
}
