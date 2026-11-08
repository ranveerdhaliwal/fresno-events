import type { NormalizedEvent } from "@fresno-events/shared";
import { load } from "cheerio";
import { instantFromPacificLocal } from "@/lib/pacific-instant.utils";

export interface LibraryEvent {
  id: number;
  title: string;
  startdt: string;
  enddt: string;
  calendar: string;
  url: string;
  all_day: boolean;
  online_event: boolean;
  description?: string;
  location?: string;
  categories?: string;
  registration_cost?: string;
  featured_image?: string;
  recurring_event?: boolean;
  calendar_id?: number;
}

export interface LibraryBranch {
  name: string;
  street: string;
  city: string;
  lat: number;
  lng: number;
  verified_on: string;
}

export function parseLibraryEvent(
  row: LibraryEvent,
  branches: Record<string, LibraryBranch>,
  now: Date,
  until: Date
): NormalizedEvent | null {
  const branch = branches[row.calendar];
  if (!branch || row.all_day || row.online_event || /^cancelled|^canceled/i.test(row.title)) return null;
  const startTs = instantFromPacificLocal(row.startdt.slice(0, 10), row.startdt.slice(11, 16));
  const endTs = instantFromPacificLocal(row.enddt.slice(0, 10), row.enddt.slice(11, 16));
  if (!startTs || !endTs) return null;
  const start = Date.parse(startTs);
  const end = Date.parse(endTs);
  if (start < now.getTime() || start >= until.getTime() || end <= start || end - start > 86_400_000) return null;
  if (!/^https:\/\/fresnolibrary\.libcal\.com\/event\/\d+(?:[/?#]|$)/.test(row.url)) return null;
  const description = load(row.description ?? "").text().trim();
  const categories = (row.categories ?? "").split(",").map(value => value.trim()).filter(Boolean);
  return {
    source: "api:fresno-library",
    sourceEventId: `libcal:${row.id}`,
    title: row.title.trim(),
    startTs,
    endTs,
    category: /storytime|children|family/i.test(row.categories ?? "") ? "family" : "community",
    venueName: `Fresno County Public Library - ${branch.name}`,
    venueAddress: branch.street,
    venueCity: branch.city,
    venueLat: branch.lat,
    venueLng: branch.lng,
    externalUrl: row.url,
    ticketUrl: row.url,
    descriptionText: [description, row.location ? `Room: ${row.location}` : ""].filter(Boolean).join("\n\n"),
    tags: ["library", ...categories],
    ...(row.recurring_event && row.calendar_id ? {
      seriesId: `series:fcpl:${row.calendar_id}:${row.title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")}`,
      seriesName: row.title.trim()
    } : {}),
    ...(row.featured_image?.startsWith("https://") ? { imageUrl: row.featured_image } : {}),
    ...(row.registration_cost?.trim() ? { priceNotes: row.registration_cost.trim() } : {})
  };
}
