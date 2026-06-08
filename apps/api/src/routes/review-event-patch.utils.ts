import {
  EVENT_PRIORITY_DEFAULT,
  EVENT_PRIORITY_MAX,
  EVENT_PRIORITY_MIN,
  type Event,
  type EventCategory,
  type ImageAsset,
  type NormalizedEvent,
  type Venue
} from "@fresno-events/shared";

import type { Env } from "@/env";
import { toEventSource } from "@/lib/event-source";
import { mirrorImageToR2 } from "@/lib/images";
import { mergeNormalizedEvent, toEventCategory } from "@/routes/review-mappers.utils";
import { upsertVenue } from "@/routes/review-event.service";
import { supabaseReviewRequest } from "@/routes/review-supabase.utils";
import { ReviewRouteError } from "@/routes/review.errors";
import type { SupabaseEventRow } from "@/routes/review.types";
import { mapEventRow } from "@/routes/review-event.service";

export function publishedEventToNormalized(
  event: Event,
  venue: Venue,
  heroImage?: ImageAsset
): NormalizedEvent {
  return {
    source: toEventSource(event.source),
    sourceEventId: event.sourceEventId ?? event.id,
    title: event.title,
    ...(event.descriptionHtml ? { descriptionHtml: event.descriptionHtml } : {}),
    ...(event.descriptionText ? { descriptionText: event.descriptionText } : {}),
    venueName: venue.name,
    ...(venue.address ? { venueAddress: venue.address } : {}),
    venueCity: venue.city,
    ...(venue.lat !== undefined ? { venueLat: venue.lat } : {}),
    ...(venue.lng !== undefined ? { venueLng: venue.lng } : {}),
    startTs: event.startTs,
    ...(event.endTs ? { endTs: event.endTs } : {}),
    timezone: event.timezone,
    category: event.category as EventCategory,
    subcategories: event.subcategories,
    tags: event.tags,
    ...(event.priceMin !== undefined ? { priceMin: event.priceMin } : {}),
    ...(event.priceMax !== undefined ? { priceMax: event.priceMax } : {}),
    currency: event.currency,
    ...(event.ticketUrl ? { ticketUrl: event.ticketUrl } : {}),
    ...(event.externalUrl ? { externalUrl: event.externalUrl } : {}),
    ...(heroImage?.cdnUrl ? { imageUrl: heroImage.cdnUrl } : {})
  };
}

export function clampPatchPriority(value: number | undefined, fallback: number): number {
  if (value === undefined) {
    return fallback;
  }
  if (!Number.isInteger(value) || value < EVENT_PRIORITY_MIN || value > EVENT_PRIORITY_MAX) {
    throw new ReviewRouteError("priority must be an integer 0–5.", 400);
  }
  return value;
}

export async function patchPublishedEventById(
  env: Env,
  eventId: string,
  options: { eventOverride?: unknown; priority?: number }
): Promise<Event> {
  const existing = await fetchPublishedEventRow(env, eventId);
  if (!existing) {
    throw new ReviewRouteError(`Published event ${eventId} was not found.`, 404);
  }

  const baseline = publishedEventToNormalized(
    mapEventRow(existing),
    {
      id: existing.venue_id,
      slug: "",
      name: existing.venue?.name ?? "Venue",
      city: existing.venue?.city ?? "Fresno",
      socials: {},
      createdAt: existing.created_at,
      updatedAt: existing.updated_at,
      ...(existing.venue?.address ? { address: existing.venue.address } : {}),
      ...(existing.venue?.lat != null ? { lat: existing.venue.lat } : {}),
      ...(existing.venue?.lng != null ? { lng: existing.venue.lng } : {})
    },
    existing.hero_image
      ? {
          id: existing.hero_image.id,
          storageKey: existing.hero_image.storage_key,
          cdnUrl: existing.hero_image.cdn_url,
          width: existing.hero_image.width ?? 0,
          height: existing.hero_image.height ?? 0,
          createdAt: existing.created_at
        }
      : undefined
  );

  const normalized = mergeNormalizedEvent(baseline, options.eventOverride);
  const venue = await upsertVenue(env, normalized);

  let heroImageId = existing.hero_image_id;
  if (normalized.imageUrl && normalized.imageUrl !== baseline.imageUrl) {
    const mirrored = await mirrorImageToR2(env, normalized.imageUrl, normalized.title);
    heroImageId = mirrored?.id ?? heroImageId;
  }

  const priority = clampPatchPriority(options.priority, existing.priority ?? EVENT_PRIORITY_DEFAULT);
  const now = new Date().toISOString();

  const params = new URLSearchParams({ id: `eq.${eventId}` });
  const rows = await supabaseReviewRequest<SupabaseEventRow[]>(env, `/rest/v1/events?${params}`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      Prefer: "return=representation"
    },
    body: JSON.stringify({
      title: normalized.title,
      description_html: normalized.descriptionHtml ?? null,
      description_text: normalized.descriptionText ?? null,
      venue_id: venue.id,
      start_ts: normalized.startTs,
      end_ts: normalized.endTs ?? null,
      timezone: normalized.timezone ?? "America/Los_Angeles",
      category: normalized.category ?? "community",
      price_min: normalized.priceMin ?? null,
      price_max: normalized.priceMax ?? null,
      ticket_url: normalized.ticketUrl ?? null,
      external_url: normalized.externalUrl ?? null,
      hero_image_id: heroImageId,
      priority,
      updated_at: now
    })
  });

  const row = rows[0];
  if (!row) {
    throw new ReviewRouteError("Event patch did not return a row.");
  }

  return mapEventRow(row);
}

async function fetchPublishedEventRow(env: Env, eventId: string) {
  const params = new URLSearchParams({
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
      "category",
      "subcategories",
      "tags",
      "price_min",
      "price_max",
      "currency",
      "is_free",
      "ticket_url",
      "external_url",
      "status",
      "gallery_image_ids",
      "all_artist_ids",
      "dedupe_hash",
      "confidence_score",
      "last_seen_at",
      "priority",
      "series_id",
      "series_name",
      "lineup",
      "hero_image_id",
      "created_at",
      "updated_at",
      "venue:venues(name,city,address,lat,lng)",
      "hero_image:images(id,storage_key,cdn_url,width,height,created_at)"
    ].join(","),
    id: `eq.${eventId}`,
    limit: "1"
  });

  const rows = await supabaseReviewRequest<
    Array<
      SupabaseEventRow & {
        hero_image?: { id: string; storage_key: string; cdn_url: string; width: number | null; height: number | null; created_at: string } | null;
        hero_image_id: string | null;
      }
    >
  >(env, `/rest/v1/events?${params}`);

  return rows[0] ?? null;
}

export async function getPublishedEventForAdmin(env: Env, eventId: string) {
  const row = await fetchPublishedEventRow(env, eventId);
  if (!row) {
    return null;
  }

  const event = mapEventRow(row);
  return {
    event,
    venue: {
      id: row.venue_id,
      slug: slugFromName(row.venue?.name ?? "venue"),
      name: row.venue?.name ?? "Venue",
      city: row.venue?.city ?? "Fresno",
      socials: {},
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      ...(row.venue?.address ? { address: row.venue.address } : {}),
      ...(row.venue?.lat != null ? { lat: row.venue.lat } : {}),
      ...(row.venue?.lng != null ? { lng: row.venue.lng } : {})
    },
    ...(row.hero_image
      ? {
          heroImage: {
            id: row.hero_image.id,
            storageKey: row.hero_image.storage_key,
            cdnUrl: row.hero_image.cdn_url,
            width: row.hero_image.width ?? 0,
            height: row.hero_image.height ?? 0,
            createdAt: row.created_at
          }
        }
      : {})
  };
}

function slugFromName(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "venue";
}
