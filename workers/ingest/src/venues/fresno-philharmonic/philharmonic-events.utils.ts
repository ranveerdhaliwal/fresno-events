import type { NormalizedEvent } from "@fresno-events/shared";
import { load } from "cheerio";
import { instantFromPacificLocal } from "@/lib/pacific-instant.utils";

export interface PhilharmonicVenue {
  address: string;
  city: string;
  lat: number;
  lng: number;
}

const MONTHS = ["january", "february", "march", "april", "may", "june", "july", "august", "september", "october", "november", "december"];

export function parsePhilharmonicDate(value: string): string | null {
  const match = /([A-Za-z]+)\s+(\d{1,2}),\s+(\d{4})\s*(?:\|\s*)?(\d{1,2}):(\d{2})\s*(am|pm)/i.exec(value);
  if (!match) return null;
  const month = MONTHS.indexOf(match[1]!.toLowerCase()) + 1;
  const hour12 = Number(match[4]);
  if (!month || hour12 < 1 || hour12 > 12 || Number(match[5]) > 59) return null;
  const hour = hour12 % 12 + (match[6]!.toLowerCase() === "pm" ? 12 : 0);
  const date = `${match[3]}-${String(month).padStart(2, "0")}-${match[2]!.padStart(2, "0")}`;
  return instantFromPacificLocal(date, `${String(hour).padStart(2, "0")}:${match[5]}`);
}

export function parsePhilharmonicListing(
  html: string,
  venues: Record<string, PhilharmonicVenue>,
  now: Date
): NormalizedEvent[] {
  const $ = load(html);
  const events: NormalizedEvent[] = [];
  const until = now.getTime() + 180 * 86_400_000;
  $(".event-outer-wrapper").each((_, element) => {
    const card = $(element);
    const title = card.find(".event-name").first().text().trim();
    const venueName = card.find(".event-location").first().text().trim();
    const venue = venues[venueName];
    const href = card.find("a.event-button").attr("href");
    if (!title || !venue || !href) return;
    const externalUrl = new URL(href, "https://fresnophil.org/");
    if (externalUrl.hostname !== "fresnophil.org" || !externalUrl.pathname.startsWith("/events/")) return;
    const slug = externalUrl.pathname.split("/").filter(Boolean).at(-1)!;
    const imageUrl = card.find("img").first().attr("src");
    card.find(".event-date").each((_, dateElement) => {
      const startTs = parsePhilharmonicDate($(dateElement).text().trim());
      if (!startTs || Date.parse(startTs) < now.getTime() || Date.parse(startTs) >= until) return;
      events.push({
        source: "scrape:fresnophil.org",
        sourceEventId: `fresnophil:${slug}:${startTs}`,
        title,
        seriesId: `series:fresnophil:${slug}`,
        seriesName: title,
        startTs,
        category: "music",
        venueName,
        venueAddress: venue.address,
        venueCity: venue.city,
        venueLat: venue.lat,
        venueLng: venue.lng,
        externalUrl: externalUrl.href,
        tags: ["classical", "orchestra", "live music"],
        ...(imageUrl?.startsWith("https://") ? { imageUrl } : {})
      });
    });
  });
  return events;
}
