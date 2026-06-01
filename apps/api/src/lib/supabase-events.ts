import {
  EVENT_PRIORITY_DEFAULT,
  eventCategories,
  type Event,
  type EventCategory,
  type EventDetailResponse,
  type EventListItem,
  parseLineup,
  type EventListResponse,
  type EventStatus,
  type ImageAsset,
  type Venue
} from "@fresno-events/shared";

import type { Env } from "@/env";
import { toEventSource } from "@/lib/event-source";
import type { SupabaseEventRow, SupabaseImageRow, SupabaseVenueRow } from "@/lib/supabase-events.types";

export type { SupabaseEventRow, SupabaseImageRow, SupabaseVenueRow } from "@/lib/supabase-events.types";

const scheduledStatuses = ["scheduled", "sold_out", "postponed"] as const;
const validStatuses: EventStatus[] = ["scheduled", "cancelled", "postponed", "sold_out", "inferred_cancelled"];

export class SupabaseEventsError extends Error {
  constructor(
    message: string,
    readonly status = 502
  ) {
    super(message);
    this.name = "SupabaseEventsError";
  }
}

export async function listEventsFromSupabase(
  env: Env,
  options: { from: Date; until?: Date; limit: number; maxPriority?: number; seriesId?: string }
): Promise<EventListResponse> {
  const { url, key } = getSupabaseConfig(env);
  const filters: Record<string, string> = {
    status: `in.(${scheduledStatuses.join(",")})`,
    start_ts: `gte.${options.from.toISOString()}`,
    order: "priority.asc,start_ts.asc",
    limit: String(options.limit)
  };

  if (options.maxPriority !== undefined) {
    filters.priority = `lte.${options.maxPriority}`;
  }

  if (options.seriesId) {
    filters.series_id = `eq.${options.seriesId}`;
  }

  const params = createEventParams(filters);

  if (options.until) {
    params.set("start_ts", `gte.${options.from.toISOString()}`);
    params.append("start_ts", `lt.${options.until.toISOString()}`);
  }

  const rows = await fetchEventRows(url, key, params);

  return {
    items: rows.map(mapEventRow),
    nextCursor: null,
    generatedAt: new Date().toISOString()
  };
}

export async function getEventFromSupabase(env: Env, slug: string): Promise<EventDetailResponse | null> {
  const { url, key } = getSupabaseConfig(env);
  const params = createEventParams({
    slug: `eq.${slug}`,
    status: `in.(${scheduledStatuses.join(",")})`,
    limit: "1"
  });
  const rows = await fetchEventRows(url, key, params);
  const [row] = rows;

  if (!row) {
    return null;
  }

  const item = mapEventRow(row);
  const galleryImages = await fetchImagesByIds(url, key, item.event.galleryImageIds);

  let seriesEvents: EventListItem[] | undefined;
  if (row.series_id) {
    const siblingParams = createEventParams({
      series_id: `eq.${row.series_id}`,
      status: `in.(${scheduledStatuses.join(",")})`,
      id: `neq.${row.id}`,
      start_ts: `gte.${new Date().toISOString()}`,
      order: "start_ts.asc",
      limit: "20"
    });
    const siblingRows = await fetchEventRows(url, key, siblingParams);
    const mapped = siblingRows.map(mapEventRow);
    if (mapped.length > 0) {
      seriesEvents = mapped;
    }
  }

  return {
    ...item,
    galleryImages,
    relatedEvents: [],
    ...(seriesEvents ? { seriesEvents } : {})
  };
}

export async function listEventsByIds(env: Env, ids: string[]): Promise<EventListItem[]> {
  if (ids.length === 0) {
    return [];
  }

  const { url, key } = getSupabaseConfig(env);
  const params = createEventParams({
    id: `in.(${ids.join(",")})`,
    limit: String(ids.length)
  });

  const rows = await fetchEventRows(url, key, params);
  const items = rows.map(mapEventRow);
  const byId = new Map(items.map((item) => [item.event.id, item]));
  return ids.flatMap((id) => {
    const item = byId.get(id);
    return item ? [item] : [];
  });
}

export async function searchEventsFromSupabase(
  env: Env,
  options: { q: string; limit: number; from?: Date }
): Promise<EventListItem[]> {
  const { url, key } = getSupabaseConfig(env);
  const filters: Record<string, string> = {
    status: `in.(${scheduledStatuses.join(",")})`,
    title: `ilike.*${options.q.replace(/[%_]/g, "")}*`,
    order: "start_ts.asc",
    limit: String(options.limit)
  };

  if (options.from) {
    filters.start_ts = `gte.${options.from.toISOString()}`;
  }

  const rows = await fetchEventRows(url, key, createEventParams(filters));
  return rows.map(mapEventRow);
}

function getSupabaseConfig(env: Env) {
  const url = env.SUPABASE_URL?.replace(/\/$/, "");
  const key = env.SUPABASE_SERVICE_ROLE_KEY ?? env.SUPABASE_ANON_KEY;

  if (!url || !key) {
    throw new SupabaseEventsError("Supabase URL and key are required before the events API can read data.", 503);
  }

  return { url, key };
}

function createEventParams(filters: Record<string, string>) {
  return new URLSearchParams({
    select: [
      "id",
      "slug",
      "source",
      "source_event_id",
      "source_refs",
      "title",
      "description_html",
      "description_text",
      "venue_id",
      "start_ts",
      "end_ts",
      "timezone",
      "doors_ts",
      "category",
      "subcategories",
      "tags",
      "price_min",
      "price_max",
      "currency",
      "is_free",
      "ticket_url",
      "age_restriction",
      "status",
      "hero_image_id",
      "gallery_image_ids",
      "primary_artist_id",
      "all_artist_ids",
      "external_url",
      "dedupe_hash",
      "confidence_score",
      "last_seen_at",
      "priority",
      "series_id",
      "series_name",
      "lineup",
      "created_at",
      "updated_at",
      "venue:venues(id,slug,name,address,city,neighborhood,lat,lng,capacity,website,phone,socials,hero_image_id,description,primary_category,created_at,updated_at)",
      "hero_image:images(id,storage_key,cdn_url,width,height,blurhash,dominant_color,alt_text,source_url,license,created_at)"
    ].join(","),
    ...filters
  });
}

async function fetchEventRows(url: string, key: string, params: URLSearchParams) {
  const response = await fetch(`${url}/rest/v1/events?${params}`, {
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      Accept: "application/json"
    }
  });

  if (!response.ok) {
    const body = await response.text();
    throw new SupabaseEventsError(`Supabase events query failed with ${response.status}: ${body}`);
  }

  return await response.json() as SupabaseEventRow[];
}

async function fetchImagesByIds(url: string, key: string, ids: string[]): Promise<ImageAsset[]> {
  if (ids.length === 0) {
    return [];
  }

  const params = new URLSearchParams({
    select: "id,storage_key,cdn_url,width,height,blurhash,dominant_color,alt_text,source_url,license,created_at",
    id: `in.(${ids.join(",")})`
  });
  const response = await fetch(`${url}/rest/v1/images?${params}`, {
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      Accept: "application/json"
    }
  });

  if (!response.ok) {
    const body = await response.text();
    throw new SupabaseEventsError(`Supabase images query failed with ${response.status}: ${body}`);
  }

  const rows = await response.json() as SupabaseImageRow[];
  const imagesById = new Map(rows.map((row) => [row.id, mapImage(row)]));
  return ids.flatMap((id) => imagesById.get(id) ?? []);
}

function mapEventRow(row: SupabaseEventRow): EventListItem {
  if (!row.venue) {
    throw new SupabaseEventsError(`Event ${row.id} is missing its venue relationship.`);
  }

  const lineup = parseLineup(row.lineup);

  const event: Event = {
    id: row.id,
    slug: row.slug,
    source: toEventSource(row.source),
    sourceRefs: toStringRecord(row.source_refs),
    title: row.title,
    venueId: row.venue_id,
    startTs: row.start_ts,
    timezone: row.timezone ?? "America/Los_Angeles",
    category: toEventCategory(row.category),
    subcategories: row.subcategories ?? [],
    tags: row.tags ?? [],
    currency: row.currency ?? "USD",
    status: toEventStatus(row.status),
    galleryImageIds: row.gallery_image_ids ?? [],
    allArtistIds: row.all_artist_ids ?? [],
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    ...(row.source_event_id ? { sourceEventId: row.source_event_id } : {}),
    ...(row.description_html ? { descriptionHtml: row.description_html } : {}),
    ...(row.description_text ? { descriptionText: row.description_text } : {}),
    ...(row.end_ts ? { endTs: row.end_ts } : {}),
    ...(row.doors_ts ? { doorsTs: row.doors_ts } : {}),
    ...(row.price_min !== null ? { priceMin: toNumber(row.price_min) } : {}),
    ...(row.price_max !== null ? { priceMax: toNumber(row.price_max) } : {}),
    ...(row.is_free !== null ? { isFree: row.is_free } : {}),
    ...(row.ticket_url ? { ticketUrl: row.ticket_url } : {}),
    ...(row.age_restriction ? { ageRestriction: row.age_restriction } : {}),
    ...(row.hero_image_id ? { heroImageId: row.hero_image_id } : {}),
    ...(row.primary_artist_id ? { primaryArtistId: row.primary_artist_id } : {}),
    ...(row.external_url ? { externalUrl: row.external_url } : {}),
    ...(row.dedupe_hash ? { dedupeHash: row.dedupe_hash } : {}),
    ...(row.confidence_score !== null ? { confidenceScore: row.confidence_score } : {}),
    ...(row.last_seen_at ? { lastSeenAt: row.last_seen_at } : {}),
    priority: row.priority ?? EVENT_PRIORITY_DEFAULT,
    ...(row.series_id ? { seriesId: row.series_id } : {}),
    ...(row.series_name ? { seriesName: row.series_name } : {}),
    ...(lineup ? { lineup } : {})
  };

  const venue = mapVenue(row.venue);
  const heroImage = row.hero_image ? mapImage(row.hero_image) : undefined;

  return heroImage ? { event, venue, heroImage } : { event, venue };
}

function mapVenue(row: SupabaseVenueRow): Venue {
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    city: row.city,
    socials: toStringRecord(row.socials),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    ...(row.address ? { address: row.address } : {}),
    ...(row.neighborhood ? { neighborhood: row.neighborhood } : {}),
    ...(row.lat !== null ? { lat: row.lat } : {}),
    ...(row.lng !== null ? { lng: row.lng } : {}),
    ...(row.capacity !== null ? { capacity: row.capacity } : {}),
    ...(row.website ? { website: row.website } : {}),
    ...(row.phone ? { phone: row.phone } : {}),
    ...(row.hero_image_id ? { heroImageId: row.hero_image_id } : {}),
    ...(row.description ? { description: row.description } : {}),
    ...(row.primary_category ? { primaryCategory: toEventCategory(row.primary_category) } : {})
  };
}

function mapImage(row: SupabaseImageRow): ImageAsset {
  return {
    id: row.id,
    storageKey: row.storage_key,
    cdnUrl: row.cdn_url,
    width: row.width ?? 0,
    height: row.height ?? 0,
    createdAt: row.created_at,
    ...(row.blurhash ? { blurhash: row.blurhash } : {}),
    ...(row.dominant_color ? { dominantColor: row.dominant_color } : {}),
    ...(row.alt_text ? { altText: row.alt_text } : {}),
    ...(row.source_url ? { sourceUrl: row.source_url } : {}),
    ...(row.license ? { license: row.license } : {})
  };
}

function toEventCategory(value: string | null): EventCategory {
  return eventCategories.includes(value as EventCategory) ? value as EventCategory : "community";
}

function toEventStatus(value: string | null): EventStatus {
  return validStatuses.includes(value as EventStatus) ? value as EventStatus : "scheduled";
}

function toStringRecord(value: unknown): Record<string, string> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }

  return Object.fromEntries(
    Object.entries(value).flatMap(([key, recordValue]) =>
      typeof recordValue === "string" ? [[key, recordValue]] : []
    )
  );
}

function toNumber(value: number | string) {
  return typeof value === "number" ? value : Number(value);
}
