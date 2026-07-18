import {
  EVENT_PRIORITY_DEFAULT,
  eventContentSignature,
  normalizeVenueStreetAddress,
  parseLineup,
  type Event,
  type EventCandidate,
  type NormalizedEvent
} from "@fresno-events/shared";

import type { Env } from "@/env";
import { geocodeAddress } from "@/lib/geocode";
import { toEventSource } from "@/lib/event-source";
import { logStructured } from "@/lib/structured-log";
import {
  buildAlternatesFromCandidates,
  mergeSourceRefsWithAlternates
} from "@/routes/review/occurrence.utils";
import { ReviewRouteError } from "@/routes/review/errors";
import {
  buildEventSlug,
  buildEventSlugDisambiguated,
  compactRecord,
  slugify,
  toEventCategory,
  toNumber,
  toStringRecord
} from "@/routes/review/mappers.utils";
import { supabaseReviewRequest } from "@/routes/review/supabase.utils";
import { fetchVenueCoordsByAddress, fetchVenueCoordsBySlug } from "@/routes/review/venue-preview.utils";
import type { SupabaseEventRow, SupabaseEventWithVenueRow, SupabaseVenueRow } from "@/routes/review/types";

export function mapEventRow(row: SupabaseEventRow): Event {
  const lineup = parseLineup(row.lineup);

  return {
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
    status: "scheduled",
    galleryImageIds: row.gallery_image_ids ?? [],
    allArtistIds: row.all_artist_ids ?? [],
    priority: row.priority ?? EVENT_PRIORITY_DEFAULT,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    ...(row.source_event_id ? { sourceEventId: row.source_event_id } : {}),
    ...(row.description_html ? { descriptionHtml: row.description_html } : {}),
    ...(row.description_text ? { descriptionText: row.description_text } : {}),
    ...(row.posted_at ? { postedAt: row.posted_at } : {}),
    ...(row.last_verified_at ? { lastVerifiedAt: row.last_verified_at } : {}),
    ...(row.source_sync_id ? { sourceSyncId: row.source_sync_id } : {}),
    ...(row.end_ts ? { endTs: row.end_ts } : {}),
    ...(row.price_min !== null ? { priceMin: toNumber(row.price_min) } : {}),
    ...(row.price_max !== null ? { priceMax: toNumber(row.price_max) } : {}),
    ...(row.is_free !== null ? { isFree: row.is_free } : {}),
    ...(row.ticket_url ? { ticketUrl: row.ticket_url } : {}),
    ...(row.external_url ? { externalUrl: row.external_url } : {}),
    ...(row.dedupe_hash ? { dedupeHash: row.dedupe_hash } : {}),
    ...(row.confidence_score !== null ? { confidenceScore: row.confidence_score } : {}),
    ...(row.last_seen_at ? { lastSeenAt: row.last_seen_at } : {}),
    ...(row.series_id ? { seriesId: row.series_id } : {}),
    ...(row.series_name ? { seriesName: row.series_name } : {}),
    ...(lineup ? { lineup } : {}),
    ...(row.map_pin_emoji != null ? { mapPinEmoji: row.map_pin_emoji } : {})
  };
}

export async function upsertVenue(env: Env, event: NormalizedEvent) {
  const venueSlug = slugify(event.venueName);
  const address = normalizeVenueStreetAddress(event.venueAddress, event.venueCity);
  const city = event.venueCity ?? "Fresno";
  const venueRow: Record<string, unknown> = {
    slug: venueSlug,
    name: event.venueName,
    address,
    city,
    primary_category: event.category ?? "community",
    updated_at: new Date().toISOString()
  };

  let lat =
    typeof event.venueLat === "number" && Number.isFinite(event.venueLat) ? event.venueLat : undefined;
  let lng =
    typeof event.venueLng === "number" && Number.isFinite(event.venueLng) ? event.venueLng : undefined;

  if (lat === undefined || lng === undefined) {
    const existing = await fetchVenueCoordsBySlug(env, venueSlug);
    if (existing?.lat != null && existing?.lng != null) {
      lat = existing.lat;
      lng = existing.lng;
    }
  }

  if ((lat === undefined || lng === undefined) && address) {
    const byAddress = await fetchVenueCoordsByAddress(env, address, city);
    if (byAddress) {
      lat = byAddress.lat;
      lng = byAddress.lng;
    }
  }

  if ((lat === undefined || lng === undefined) && address) {
    try {
      const geocoded = await geocodeAddress(env, { address, city });
      if (geocoded) {
        lat = geocoded.lat;
        lng = geocoded.lng;
        logStructured("venue_geocoded_on_upsert", { venueSlug, provider: geocoded.provider });
      }
    } catch (error) {
      logStructured("venue_geocode_on_upsert_failed", {
        venueSlug,
        message: error instanceof Error ? error.message : "geocode failed"
      });
    }
  }

  if (lat !== undefined) {
    venueRow.lat = lat;
  }
  if (lng !== undefined) {
    venueRow.lng = lng;
  }

  const rows = await supabaseReviewRequest<SupabaseVenueRow[]>(env, "/rest/v1/venues?on_conflict=slug", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Prefer: "resolution=merge-duplicates,return=representation"
    },
    body: JSON.stringify(venueRow)
  });

  const venue = rows[0];

  if (!venue) {
    throw new ReviewRouteError("Venue upsert did not return a row.");
  }

  return venue;
}

export async function getScheduledEventByOccurrenceId(
  env: Env,
  occurrenceId: string
): Promise<SupabaseEventRow | null> {
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
      "dedupe_hash",
      "confidence_score",
      "last_seen_at",
      "priority",
      "occurrence_id",
      "series_id",
      "series_name",
      "lineup",
      "created_at",
      "updated_at"
    ].join(","),
    occurrence_id: `eq.${occurrenceId}`,
    status: "eq.scheduled",
    limit: "1"
  });

  const rows = await supabaseReviewRequest<SupabaseEventRow[]>(env, `/rest/v1/events?${params}`);
  return rows[0] ?? null;
}

const scheduledEventSelect = [
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
  "dedupe_hash",
  "confidence_score",
  "last_seen_at",
  "priority",
  "occurrence_id",
  "series_id",
  "series_name",
  "lineup",
  "created_at",
  "updated_at",
  "venue:venues(name)"
].join(",");

export async function getScheduledEventByContentSignature(
  env: Env,
  normalized: Pick<NormalizedEvent, "title" | "startTs" | "venueName">
): Promise<SupabaseEventRow | null> {
  const targetSignature = eventContentSignature({
    event: { title: normalized.title, startTs: normalized.startTs },
    venue: { name: normalized.venueName }
  });

  const params = new URLSearchParams({
    select: scheduledEventSelect,
    start_ts: `eq.${normalized.startTs}`,
    status: "eq.scheduled",
    limit: "25"
  });

  const rows = await supabaseReviewRequest<SupabaseEventRow[]>(env, `/rest/v1/events?${params}`);

  for (const row of rows) {
    const signature = eventContentSignature({
      event: { title: row.title, startTs: row.start_ts },
      venue: { name: row.venue?.name ?? normalized.venueName }
    });
    if (signature === targetSignature) {
      return row;
    }
  }

  return null;
}

export async function upsertEvent(
  env: Env,
  candidate: EventCandidate,
  normalized: NormalizedEvent,
  venueId: string,
  heroImageId: string | null,
  priority: number,
  existingSlug?: string,
  siblings: EventCandidate[] = []
): Promise<Event> {
  const eventSlug = existingSlug ?? buildEventSlug(normalized.title, normalized.startTs);
  return await postApprovedEvent(
    env,
    candidate,
    normalized,
    venueId,
    heroImageId,
    priority,
    eventSlug,
    siblings
  );
}

function isEventSlugConflict(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return message.includes("23505") && message.includes("events_slug_key");
}

async function postApprovedEvent(
  env: Env,
  candidate: EventCandidate,
  normalized: NormalizedEvent,
  venueId: string,
  heroImageId: string | null,
  priority: number,
  eventSlug: string,
  siblings: EventCandidate[] = []
): Promise<Event> {
  const slugCandidates = [
    eventSlug,
    buildEventSlugDisambiguated(normalized.title, normalized.startTs, normalized.sourceEventId)
  ].filter((slug, index, slugs) => slugs.indexOf(slug) === index);

  let lastError: unknown;
  for (const slug of slugCandidates) {
    try {
      return await insertApprovedEventWithSlug(
        env,
        candidate,
        normalized,
        venueId,
        heroImageId,
        priority,
        slug,
        siblings
      );
    } catch (error) {
      if (!isEventSlugConflict(error)) {
        throw error;
      }
      lastError = error;
      logStructured("event_slug_conflict_retry", {
        level: "warn",
        candidate_id: candidate.id,
        title: normalized.title,
        slug,
        source_event_id: normalized.sourceEventId
      });
    }
  }

  throw lastError instanceof Error
    ? lastError
    : new ReviewRouteError("Event slug conflict could not be resolved.");
}

async function insertApprovedEventWithSlug(
  env: Env,
  candidate: EventCandidate,
  normalized: NormalizedEvent,
  venueId: string,
  heroImageId: string | null,
  priority: number,
  eventSlug: string,
  siblings: EventCandidate[] = []
): Promise<Event> {
  const now = new Date().toISOString();
  const sourceRefs = mergeSourceRefsWithAlternates(
    compactRecord({
      candidate_id: candidate.id,
      run_id: candidate.runId,
      source_url: candidate.sourceUrl,
      image_url: normalized.imageUrl
    }),
    buildAlternatesFromCandidates(candidate, siblings)
  );
  const rows = await supabaseReviewRequest<SupabaseEventRow[]>(
    env,
    "/rest/v1/events?on_conflict=source,source_event_id",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Prefer: "resolution=merge-duplicates,return=representation"
      },
      body: JSON.stringify({
        slug: eventSlug,
        source: normalized.source,
        source_event_id: normalized.sourceEventId,
        source_refs: sourceRefs,
        title: normalized.title,
        description_html: normalized.descriptionHtml ?? null,
        description_text: normalized.descriptionText ?? null,
        venue_id: venueId,
        start_ts: normalized.startTs,
        end_ts: normalized.endTs ?? null,
        last_verified_at: now,
        source_sync_id: normalized.sourceEventId ?? null,
        timezone: normalized.timezone ?? "America/Los_Angeles",
        category: normalized.category ?? "community",
        subcategories: normalized.subcategories ?? [],
        tags: normalized.tags ?? [],
        price_min: normalized.priceMin ?? null,
        price_max: normalized.priceMax ?? null,
        currency: normalized.currency ?? "USD",
        is_free:
          normalized.isFree === true || (normalized.priceMin === 0 && normalized.priceMax === 0) ? true : null,
        ticket_url: normalized.ticketUrl ?? null,
        external_url: normalized.externalUrl ?? candidate.sourceUrl ?? null,
        status: "scheduled",
        hero_image_id: heroImageId,
        gallery_image_ids: [],
        all_artist_ids: [],
        dedupe_hash: candidate.dedupeHash,
        confidence_score: candidate.confidenceScore,
        last_seen_at: now,
        priority,
        occurrence_id: candidate.occurrenceId,
        series_id: normalized.seriesId ?? null,
        series_name: normalized.seriesName ?? null,
        lineup: normalized.lineup ?? null,
        map_pin_emoji: normalized.mapPinEmoji ?? null,
        updated_at: now
      })
    }
  );

  const row = rows[0];

  if (!row) {
    throw new ReviewRouteError("Event approval did not return an event row.");
  }

  return mapEventRow(row);
}

export async function patchApprovedEvent(
  env: Env,
  existing: SupabaseEventRow,
  candidate: EventCandidate,
  normalized: NormalizedEvent,
  venueId: string,
  heroImageId: string | null,
  priority: number,
  siblings: EventCandidate[]
): Promise<Event> {
  const now = new Date().toISOString();
  const mergedRefs = mergeSourceRefsWithAlternates(
    toStringRecord(existing.source_refs),
    buildAlternatesFromCandidates(candidate, siblings)
  );

  const params = new URLSearchParams({ id: `eq.${existing.id}` });
  const rows = await supabaseReviewRequest<SupabaseEventRow[]>(env, `/rest/v1/events?${params}`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      Prefer: "return=representation"
    },
    body: JSON.stringify({
      source_refs: mergedRefs,
      title: normalized.title,
      description_html: normalized.descriptionHtml ?? null,
      description_text: normalized.descriptionText ?? null,
      venue_id: venueId,
      start_ts: normalized.startTs,
      end_ts: normalized.endTs ?? null,
      last_verified_at: now,
      source_sync_id: normalized.sourceEventId ?? null,
      ticket_url: normalized.ticketUrl ?? null,
      external_url: normalized.externalUrl ?? candidate.sourceUrl ?? null,
      hero_image_id: heroImageId,
      priority,
      occurrence_id: candidate.occurrenceId,
      map_pin_emoji: normalized.mapPinEmoji ?? null,
      last_seen_at: now,
      updated_at: now
    })
  });

  const row = rows[0];
  if (!row) {
    throw new ReviewRouteError("Event patch did not return a row.");
  }

  return mapEventRow(row);
}

export async function getPublishedEventForReview(env: Env, eventId: string) {
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
      "dedupe_hash",
      "confidence_score",
      "last_seen_at",
      "priority",
      "series_id",
      "series_name",
      "lineup",
      "created_at",
      "updated_at",
      "venue:venues(name,city,address)"
    ].join(","),
    id: `eq.${eventId}`,
    limit: "1"
  });

  const rows = await supabaseReviewRequest<SupabaseEventWithVenueRow[]>(env, `/rest/v1/events?${params}`);
  const row = rows[0];
  if (!row) {
    return null;
  }

  const event = mapEventRow(row);
  return {
    event,
    diffSource: {
      title: row.title,
      startTs: row.start_ts,
      ...(row.end_ts ? { endTs: row.end_ts } : {}),
      ...(row.description_text ? { descriptionText: row.description_text } : {}),
      ...(row.ticket_url ? { ticketUrl: row.ticket_url } : {}),
      ...(row.external_url ? { externalUrl: row.external_url } : {}),
      category: row.category,
      ...(row.venue?.name ? { venueName: row.venue.name } : {}),
      ...(row.venue?.city ? { venueCity: row.venue.city } : {}),
      ...(row.venue?.address ? { venueAddress: row.venue.address } : {}),
      ...(row.price_min !== null ? { priceMin: toNumber(row.price_min) } : {}),
      ...(row.price_max !== null ? { priceMax: toNumber(row.price_max) } : {})
    }
  };
}

export async function linkOccurrenceSiblings(
  env: Env,
  occurrenceId: string,
  eventId: string,
  primaryId: string
) {
  const params = new URLSearchParams({
    occurrence_id: `eq.${occurrenceId}`,
    id: `neq.${primaryId}`
  });

  await supabaseReviewRequest(env, `/rest/v1/event_candidates?${params}`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      Prefer: "return=minimal"
    },
    body: JSON.stringify({
      matched_event_id: eventId,
      updated_at: new Date().toISOString()
    })
  });
}
