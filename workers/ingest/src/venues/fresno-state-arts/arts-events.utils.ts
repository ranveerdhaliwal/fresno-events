import type { NormalizedEvent } from "@fresno-events/shared";
import { load } from "cheerio";
import verifiedVenues from "./venues.json";

const venuePins: Record<string, { lat: number; lng: number }> = verifiedVenues;

export interface CampusEvent {
  id: string;
  instanceId?: string;
  title: string;
  status: string;
  startDatetime?: string;
  endDatetime?: string;
  location?: string;
  locationDetail?: { address?: string };
  description?: string;
  descriptionText?: string;
  tags?: string[];
  image?: string;
  ticketOption?: string;
  ticketPriceMinimum?: string;
  ticketPriceMaximum?: string;
  ticketCurrency?: string;
  ticketUrl?: string;
}

function utcInstant(value?: string): string | null {
  if (!value || !/^\d{4}-\d\d-\d\dT\d\d:\d\d/.test(value)) return null;
  // The public widget interprets zone-less startDatetime/endDatetime as UTC.
  const date = new Date(/(?:Z|[+-]\d\d:\d\d)$/.test(value) ? value : `${value}Z`);
  return Number.isFinite(date.getTime()) ? date.toISOString() : null;
}

export function parseCampusEvent(row: CampusEvent, now: Date): NormalizedEvent | null {
  const startTs = utcInstant(row.startDatetime);
  const endTs = utcInstant(row.endDatetime);
  const address = row.locationDetail?.address?.trim();
  const tags = row.tags ?? [];
  if (row.status !== "CONFIRMED" || !startTs || !endTs || !address || !row.location) return null;
  if (/zoom|online|virtual/i.test(row.location) || !/\b(Fresno|Clovis)\b/i.test(address)) return null;
  if (!tags.some(tag => /^(public|music)$/i.test(tag)) && !/open to the public|all are welcome/i.test(row.descriptionText ?? "")) return null;
  const duration = Date.parse(endTs) - Date.parse(startTs);
  if (Date.parse(startTs) < now.getTime() || duration <= 0 || duration > 86_400_000) return null;
  const externalUrl = `https://cah.fresnostate.edu/calendar.html#event-details/${row.id}${row.instanceId ? `/${row.instanceId}` : ""}`;
  const priceMin = Number(row.ticketPriceMinimum);
  const priceMax = Number(row.ticketPriceMaximum);
  const venueAddress = address.replace(/,\s*(Fresno|Clovis),.*$/i, "");
  const pin = venuePins[`${row.location.trim()}|${venueAddress}`];
  return {
    source: "api:fresno-state-arts",
    sourceEventId: `moderncampus:${row.id}${row.instanceId ? `:${row.instanceId}` : ""}`,
    title: row.title.trim(),
    startTs,
    endTs,
    category: tags.includes("Music") ? "music" : "art",
    venueName: row.location.trim(),
    venueAddress,
    venueCity: /\bClovis\b/i.test(address) ? "Clovis" : "Fresno",
    ...(pin ? { venueLat: pin.lat, venueLng: pin.lng } : {}),
    externalUrl,
    descriptionText: row.descriptionText ?? load(row.description ?? "").text().trim(),
    tags,
    ...(row.image?.startsWith("https://") ? { imageUrl: row.image } : {}),
    ...(row.ticketUrl?.startsWith("https://") ? { ticketUrl: row.ticketUrl } : {}),
    ...(row.ticketOption === "FREE" ? { isFree: true, priceMin: 0, priceMax: 0 } : {}),
    ...(row.ticketOption === "PRICE_RANGE" && row.ticketPriceMinimum && Number.isFinite(priceMin) ? { priceMin } : {}),
    ...(row.ticketOption === "PRICE_RANGE" && row.ticketPriceMaximum && Number.isFinite(priceMax) ? { priceMax } : {})
  };
}
