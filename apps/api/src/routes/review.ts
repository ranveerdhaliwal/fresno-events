import { Hono } from "hono";

import {
  EVENT_PRIORITY_DEFAULT,
  EVENT_PRIORITY_MAX,
  EVENT_PRIORITY_MIN,
  eventCategories,
  type Event,
  type EventCandidate,
  type EventCandidateDetailResponse,
  type EventCandidateListResponse,
  type EventCandidateStatus,
  parseLineup,
  type CandidateBulkDeleteResponse,
  type EventCategory,
  type NormalizedEvent,
  type ReviewDecisionResponse
} from "@fresno-events/shared";

import type { Env } from "@/env";
import { toEventSource } from "@/lib/event-source";
import { mirrorImageToR2 } from "@/lib/images";
import { fail, ok } from "@/lib/responses";
import { partitionCandidatesForDelete } from "@/routes/review-delete.utils";

const validCandidateStatuses: EventCandidateStatus[] = ["pending_review", "approved", "rejected", "needs_changes", "duplicate"];

export const reviewRoute = new Hono<{ Bindings: Env }>();

reviewRoute.use("*", async (c, next) => {
  const authError = await requireReviewAuth(c.env, c.req.header("authorization"), c.req.header("x-admin-token"));

  if (authError) {
    return fail(c, authError.code, authError.message, authError.status);
  }

  await next();
});

reviewRoute
  .get("/candidates", async (c) => {
    const status = toCandidateStatus(c.req.query("status")) ?? "pending_review";
    const limit = parseLimit(c.req.query("limit"));
    const params = new URLSearchParams({
      select: candidateSelect,
      status: `eq.${status}`,
      order: "created_at.desc",
      limit: String(limit)
    });

    try {
      const rows = await supabaseRequest<SupabaseCandidateRow[]>(c.env, `/rest/v1/event_candidates?${params}`);
      return ok<EventCandidateListResponse>(c, {
        items: rows.map(mapCandidateRow),
        generatedAt: new Date().toISOString()
      });
    } catch (error) {
      return handleReviewError(c, error, "Review candidates could not be loaded.");
    }
  })
  .get("/candidates/:id", async (c) => {
    try {
      const candidate = await getCandidate(c.env, c.req.param("id"));

      if (!candidate) {
        return fail(c, "candidate_not_found", "That event candidate could not be found.", 404);
      }

      return ok<EventCandidateDetailResponse>(c, { candidate });
    } catch (error) {
      return handleReviewError(c, error, "Review candidate could not be loaded.");
    }
  })
  .post("/candidates/:id/reject", async (c) => {
    const body = await readJsonBody(c.req.raw);

    try {
      const candidate = await updateCandidate(c.env, c.req.param("id"), {
        status: "rejected",
        review_notes: typeof body.notes === "string" ? body.notes : null,
        reviewed_by: typeof body.reviewedBy === "string" ? body.reviewedBy : "admin",
        reviewed_at: new Date().toISOString()
      });

      if (!candidate) {
        return fail(c, "candidate_not_found", "That event candidate could not be found.", 404);
      }

      return ok<ReviewDecisionResponse>(c, { candidate });
    } catch (error) {
      return handleReviewError(c, error, "Review candidate could not be rejected.");
    }
  })
  .post("/candidates/:id/approve", async (c) => {
    const body = await readJsonBody(c.req.raw);

    try {
      const candidate = await getCandidate(c.env, c.req.param("id"));

      if (!candidate) {
        return fail(c, "candidate_not_found", "That event candidate could not be found.", 404);
      }

      const normalized = mergeNormalizedEvent(candidate.normalizedEvent, body.event);
      const priority = parseApprovePriority(body);
      const venue = await upsertVenue(c.env, normalized);

      const heroImage = normalized.imageUrl
        ? await mirrorImageWithLogging(c.env, normalized.imageUrl, normalized.title)
        : null;

      const event = await upsertEvent(c.env, candidate, normalized, venue.id, heroImage?.id ?? null, priority);
      const updated = await updateCandidate(c.env, candidate.id, {
        status: "approved",
        review_notes: typeof body.notes === "string" ? body.notes : candidate.reviewNotes ?? null,
        reviewed_by: typeof body.reviewedBy === "string" ? body.reviewedBy : "admin",
        reviewed_at: new Date().toISOString(),
        matched_event_id: event.id
      });

      return ok<ReviewDecisionResponse>(c, { candidate: updated ?? candidate, event });
    } catch (error) {
      return handleReviewError(c, error, "Review candidate could not be approved.");
    }
  })
  .delete("/candidates/:id", async (c) => {
    const force = c.req.query("force") === "true";

    try {
      const result = await deleteCandidates(c.env, [c.req.param("id")], { force });
      if (result.deleted === 0 && result.skipped.length > 0) {
        const skip = result.skipped[0];
        if (skip?.reason === "not_found") {
          return fail(c, "candidate_not_found", "That event candidate could not be found.", 404);
        }
        if (skip?.reason === "approved") {
          return fail(
            c,
            "candidate_delete_blocked",
            "Approved candidates cannot be deleted without force=true.",
            409
          );
        }
      }
      return ok<CandidateBulkDeleteResponse>(c, result);
    } catch (error) {
      return handleReviewError(c, error, "Review candidate could not be deleted.");
    }
  })
  .post("/candidates/bulk-delete", async (c) => {
    const force = c.req.query("force") === "true";
    const body = await readJsonBody(c.req.raw);
    const ids = Array.isArray(body.ids)
      ? body.ids.filter((id): id is string => typeof id === "string" && id.length > 0)
      : [];

    if (ids.length === 0) {
      return fail(c, "invalid_request", "ids must be a non-empty array.", 400);
    }

    if (ids.length > 100) {
      return fail(c, "invalid_request", "At most 100 ids per bulk-delete request.", 400);
    }

    try {
      const result = await deleteCandidates(c.env, ids, { force });
      return ok<CandidateBulkDeleteResponse>(c, result);
    } catch (error) {
      return handleReviewError(c, error, "Candidates could not be deleted.");
    }
  });

class ReviewRouteError extends Error {
  constructor(
    message: string,
    readonly status = 502
  ) {
    super(message);
    this.name = "ReviewRouteError";
  }
}

const candidateSelect = [
  "id",
  "run_id",
  "source",
  "source_event_id",
  "title",
  "venue_name",
  "start_ts",
  "source_url",
  "ticket_url",
  "normalized_event",
  "raw_payload",
  "dedupe_hash",
  "confidence_score",
  "suggested_priority",
  "status",
  "review_notes",
  "reviewed_at",
  "reviewed_by",
  "matched_event_id",
  "created_at",
  "updated_at"
].join(",");

async function requireReviewAuth(env: Env, authorization?: string, adminToken?: string) {
  if (!env.ADMIN_REVIEW_TOKEN) {
    return {
      code: "review_auth_unconfigured",
      message: "ADMIN_REVIEW_TOKEN must be configured before review routes can be used.",
      status: 503 as const
    };
  }

  const provided = adminToken ?? authorization?.replace(/^Bearer\s+/i, "");

  if (!provided || !(await secureCompare(provided, env.ADMIN_REVIEW_TOKEN))) {
    return {
      code: "review_auth_required",
      message: "A valid review token is required.",
      status: 401 as const
    };
  }

  return null;
}

async function secureCompare(actual: string, expected: string) {
  const [actualHash, expectedHash] = await Promise.all([sha256(actual), sha256(expected)]);
  let diff = actualHash.length ^ expectedHash.length;

  for (let index = 0; index < Math.max(actualHash.length, expectedHash.length); index += 1) {
    diff |= (actualHash[index] ?? 0) ^ (expectedHash[index] ?? 0);
  }

  return diff === 0;
}

async function sha256(value: string) {
  return new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value)));
}

async function deleteCandidates(
  env: Env,
  ids: string[],
  options: { force: boolean }
): Promise<CandidateBulkDeleteResponse> {
  const uniqueIds = [...new Set(ids)];
  const params = new URLSearchParams({
    select: "id,status",
    id: `in.(${uniqueIds.join(",")})`
  });
  const rows = await supabaseRequest<Array<{ id: string; status: string }>>(
    env,
    `/rest/v1/event_candidates?${params}`
  );
  const { toDelete, skipped } = partitionCandidatesForDelete(uniqueIds, rows, options.force);

  if (toDelete.length > 0) {
    const deleteParams = new URLSearchParams({ id: `in.(${toDelete.join(",")})` });
    await supabaseRequest(env, `/rest/v1/event_candidates?${deleteParams}`, {
      method: "DELETE",
      headers: { Prefer: "return=minimal" }
    });
  }

  return { deleted: toDelete.length, skipped };
}

async function getCandidate(env: Env, id: string) {
  const params = new URLSearchParams({ select: candidateSelect, id: `eq.${id}`, limit: "1" });
  const rows = await supabaseRequest<SupabaseCandidateRow[]>(env, `/rest/v1/event_candidates?${params}`);
  return rows[0] ? mapCandidateRow(rows[0]) : null;
}

async function updateCandidate(env: Env, id: string, patch: CandidatePatch) {
  const params = new URLSearchParams({ id: `eq.${id}` });
  const rows = await supabaseRequest<SupabaseCandidateRow[]>(env, `/rest/v1/event_candidates?${params}`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      Prefer: "return=representation"
    },
    body: JSON.stringify({ ...patch, updated_at: new Date().toISOString() })
  });

  return rows[0] ? mapCandidateRow(rows[0]) : null;
}

async function upsertVenue(env: Env, event: NormalizedEvent) {
  const slug = slugify(event.venueName);
  const rows = await supabaseRequest<SupabaseVenueRow[]>(env, "/rest/v1/venues?on_conflict=slug", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Prefer: "resolution=merge-duplicates,return=representation"
    },
    body: JSON.stringify({
      slug,
      name: event.venueName,
      address: event.venueAddress ?? null,
      city: event.venueCity ?? "Fresno",
      primary_category: event.category ?? "community",
      updated_at: new Date().toISOString()
    })
  });

  const venue = rows[0];

  if (!venue) {
    throw new ReviewRouteError("Venue upsert did not return a row.");
  }

  return venue;
}

function parseApprovePriority(body: Record<string, unknown>): number {
  const raw = body.priority;
  if (raw === undefined) {
    return EVENT_PRIORITY_DEFAULT;
  }

  if (typeof raw !== "number" || !Number.isInteger(raw) || raw < EVENT_PRIORITY_MIN || raw > EVENT_PRIORITY_MAX) {
    throw new ReviewRouteError("priority must be an integer 0–5.", 400);
  }

  return raw;
}

async function upsertEvent(
  env: Env,
  candidate: EventCandidate,
  normalized: NormalizedEvent,
  venueId: string,
  heroImageId: string | null,
  priority: number
): Promise<Event> {
  const now = new Date().toISOString();
  const sourceRefs = compactRecord({
    candidate_id: candidate.id,
    run_id: candidate.runId,
    source_url: candidate.sourceUrl,
    image_url: normalized.imageUrl
  });
  const rows = await supabaseRequest<SupabaseEventRow[]>(env, "/rest/v1/events?on_conflict=source,source_event_id", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Prefer: "resolution=merge-duplicates,return=representation"
    },
    body: JSON.stringify({
      slug: slugify(`${normalized.title}-${normalized.startTs.slice(0, 10)}`),
      source: normalized.source,
      source_event_id: normalized.sourceEventId,
      source_refs: sourceRefs,
      title: normalized.title,
      description_html: normalized.descriptionHtml ?? null,
      description_text: normalized.descriptionText ?? null,
      venue_id: venueId,
      start_ts: normalized.startTs,
      end_ts: normalized.endTs ?? null,
      timezone: normalized.timezone ?? "America/Los_Angeles",
      category: normalized.category ?? "community",
      subcategories: normalized.subcategories ?? [],
      tags: normalized.tags ?? [],
      price_min: normalized.priceMin ?? null,
      price_max: normalized.priceMax ?? null,
      currency: normalized.currency ?? "USD",
      is_free: normalized.priceMin === 0 && normalized.priceMax === 0 ? true : null,
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
      series_id: normalized.seriesId ?? null,
      series_name: normalized.seriesName ?? null,
      lineup: normalized.lineup ?? null,
      updated_at: now
    })
  });

  const row = rows[0];

  if (!row) {
    throw new ReviewRouteError("Event approval did not return an event row.");
  }

  return mapEventRow(row);
}

async function supabaseRequest<T>(env: Env, path: string, init: RequestInit = {}): Promise<T> {
  const { url, key } = getSupabaseServiceConfig(env);
  const response = await fetch(`${url}${path}`, {
    ...init,
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      Accept: "application/json",
      ...init.headers
    }
  });

  if (!response.ok) {
    const body = await response.text();
    throw new ReviewRouteError(`Supabase review query failed with ${response.status}: ${body}`, response.status === 401 ? 503 : 502);
  }

  return await response.json() as T;
}

function getSupabaseServiceConfig(env: Env) {
  const url = env.SUPABASE_URL?.replace(/\/$/, "");
  const key = env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    throw new ReviewRouteError("Supabase URL and service role key are required for review routes.", 503);
  }

  return { url, key };
}

function mapCandidateRow(row: SupabaseCandidateRow): EventCandidate {
  return {
    id: row.id,
    source: toEventSource(row.source),
    sourceEventId: row.source_event_id,
    title: row.title,
    venueName: row.venue_name,
    startTs: row.start_ts,
    normalizedEvent: row.normalized_event as NormalizedEvent,
    rawPayload: toRecord(row.raw_payload),
    dedupeHash: row.dedupe_hash,
    confidenceScore: row.confidence_score,
    ...(row.suggested_priority !== null ? { suggestedPriority: row.suggested_priority } : {}),
    status: toCandidateStatus(row.status) ?? "pending_review",
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    ...(row.run_id ? { runId: row.run_id } : {}),
    ...(row.source_url ? { sourceUrl: row.source_url } : {}),
    ...(row.ticket_url ? { ticketUrl: row.ticket_url } : {}),
    ...(row.review_notes ? { reviewNotes: row.review_notes } : {}),
    ...(row.reviewed_at ? { reviewedAt: row.reviewed_at } : {}),
    ...(row.reviewed_by ? { reviewedBy: row.reviewed_by } : {}),
    ...(row.matched_event_id ? { matchedEventId: row.matched_event_id } : {})
  };
}

function mapEventRow(row: SupabaseEventRow): Event {
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
    ...(lineup ? { lineup } : {})
  };
}

function mergeNormalizedEvent(current: NormalizedEvent, override: unknown): NormalizedEvent {
  if (!override || typeof override !== "object" || Array.isArray(override)) {
    return current;
  }

  return {
    ...current,
    ...override,
    source: current.source,
    sourceEventId: current.sourceEventId
  } as NormalizedEvent;
}

function toCandidateStatus(value: string | undefined | null) {
  return validCandidateStatuses.includes(value as EventCandidateStatus) ? value as EventCandidateStatus : null;
}

function toEventCategory(value: string | null | undefined): EventCategory {
  return eventCategories.includes(value as EventCategory) ? value as EventCategory : "community";
}

function parseLimit(value: string | undefined) {
  const parsed = Number(value ?? 50);

  if (!Number.isFinite(parsed)) {
    return 50;
  }

  return Math.min(Math.max(Math.trunc(parsed), 1), 100);
}

async function readJsonBody(request: Request) {
  try {
    const parsed = await request.json();
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed as Record<string, unknown> : {};
  } catch {
    return {};
  }
}

function compactRecord(input: Record<string, string | undefined>) {
  return Object.fromEntries(Object.entries(input).filter((entry): entry is [string, string] => typeof entry[1] === "string" && entry[1].length > 0));
}

function toRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function toStringRecord(value: unknown): Record<string, string> {
  return Object.fromEntries(Object.entries(toRecord(value)).flatMap(([key, recordValue]) => (typeof recordValue === "string" ? [[key, recordValue]] : [])));
}

function toNumber(value: number | string) {
  return typeof value === "number" ? value : Number(value);
}

function slugify(value: string) {
  return value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80) || "event";
}

async function mirrorImageWithLogging(env: Env, imageUrl: string, altText: string) {
  try {
    return await mirrorImageToR2(env, imageUrl, altText);
  } catch (error) {
    console.log(JSON.stringify({
      event: "image_mirror_failed",
      image_url: imageUrl,
      message: error instanceof Error ? error.message : String(error)
    }));
    return null;
  }
}

function handleReviewError(c: Parameters<typeof fail>[0], error: unknown, fallbackMessage: string) {
  if (error instanceof ReviewRouteError) {
    return fail(c, "review_unavailable", error.message, error.status === 503 ? 503 : 502);
  }

  return fail(c, "review_unavailable", fallbackMessage, 502);
}

interface CandidatePatch {
  status: EventCandidateStatus;
  review_notes?: string | null;
  reviewed_at?: string;
  reviewed_by?: string;
  matched_event_id?: string;
}

interface SupabaseCandidateRow {
  id: string;
  run_id: string | null;
  source: string;
  source_event_id: string;
  title: string;
  venue_name: string;
  start_ts: string;
  source_url: string | null;
  ticket_url: string | null;
  normalized_event: unknown;
  raw_payload: unknown;
  dedupe_hash: string;
  confidence_score: number;
  suggested_priority: number | null;
  status: string;
  review_notes: string | null;
  reviewed_at: string | null;
  reviewed_by: string | null;
  matched_event_id: string | null;
  created_at: string;
  updated_at: string;
}

interface SupabaseVenueRow {
  id: string;
}

interface SupabaseEventRow {
  id: string;
  slug: string;
  source: string;
  source_event_id: string | null;
  source_refs: unknown;
  title: string;
  description_html: string | null;
  description_text: string | null;
  venue_id: string;
  start_ts: string;
  end_ts: string | null;
  timezone: string | null;
  category: string | null;
  subcategories: string[] | null;
  tags: string[] | null;
  price_min: number | string | null;
  price_max: number | string | null;
  currency: string | null;
  is_free: boolean | null;
  ticket_url: string | null;
  status: string | null;
  gallery_image_ids: string[] | null;
  all_artist_ids: string[] | null;
  external_url: string | null;
  dedupe_hash: string | null;
  confidence_score: number | null;
  last_seen_at: string | null;
  priority: number | null;
  series_id: string | null;
  series_name: string | null;
  lineup: unknown;
  created_at: string;
  updated_at: string;
}
