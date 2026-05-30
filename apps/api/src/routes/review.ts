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
  type CandidateBulkApproveResponse,
  type CandidateBulkApproveChangesResponse,
  type CandidateBulkDeleteResponse,
  type EventCategory,
  type NormalizedEvent,
  type ReviewDecisionResponse
} from "@fresno-events/shared";

import type { Env } from "@/env";
import { toEventSource } from "@/lib/event-source";
import { mirrorImageToR2 } from "@/lib/images";
import { fail, ok } from "@/lib/responses";
import { logError, logStructured } from "@/lib/structured-log";
import {
  chunkIds,
  mergeBulkApproveResults,
  parseBulkApproveAllLimit,
  parseBulkApproveIds,
  partitionCandidatesForApprove,
  resolveBulkApprovePriority,
  validateBulkApproveIdCount
} from "@/routes/review-approve.utils";
import { partitionCandidatesForDelete } from "@/routes/review-delete.utils";
import {
  chunkApproveChangesIds,
  mergeBulkApproveChangesResults,
  parseBulkApproveChangesIds,
  partitionCandidatesForApproveChanges,
  validateBulkApproveChangesIdCount
} from "@/routes/review-approve-changes.utils";
import { buildContentDiff } from "@/routes/review-diff.utils";
import {
  buildAlternatesFromCandidates,
  mergeSourceRefsWithAlternates,
  toLinkedCandidate
} from "@/routes/review-occurrence.utils";

const validCandidateStatuses: EventCandidateStatus[] = [
  "awaiting_enrichment",
  "pending_review",
  "approved",
  "rejected",
  "needs_changes",
  "duplicate"
];

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
    const offset = parseOffset(c.req.query("offset"));
    const params = new URLSearchParams({
      select: candidateSelect,
      status: `eq.${status}`,
      order: "created_at.desc",
      limit: String(limit),
      offset: String(offset)
    });
    if (status === "pending_review") {
      params.set("canonical_candidate_id", "is.null");
    }

    try {
      const rows = await supabaseRequest<SupabaseCandidateRow[]>(c.env, `/rest/v1/event_candidates?${params}`);
      return ok<EventCandidateListResponse>(c, {
        items: rows.map(mapCandidateRow),
        generatedAt: new Date().toISOString(),
        offset,
        limit
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

      let publishedEvent: Event | undefined;
      let contentDiff: EventCandidateDetailResponse["contentDiff"];

      if (candidate.matchedEventId) {
        const published = await getPublishedEventForReview(c.env, candidate.matchedEventId);
        if (published) {
          publishedEvent = published.event;
          if (candidate.status === "needs_changes") {
            contentDiff = buildContentDiff(published.diffSource, candidate.normalizedEvent) ?? undefined;
          }
        }
      }

      const siblings = await fetchCandidatesByOccurrenceId(c.env, candidate.occurrenceId, candidate.id);
      const linkedCandidates = siblings.map(toLinkedCandidate);

      return ok<EventCandidateDetailResponse>(c, {
        candidate,
        ...(linkedCandidates.length > 0 ? { linkedCandidates } : {}),
        ...(publishedEvent ? { publishedEvent } : {}),
        ...(contentDiff ? { contentDiff } : {})
      });
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

      const result = await approveCandidateCore(c.env, candidate, {
        eventOverride: body.event,
        priority: parseApprovePriority(body),
        notes: typeof body.notes === "string" ? body.notes : undefined,
        reviewedBy: typeof body.reviewedBy === "string" ? body.reviewedBy : "admin"
      });

      return ok<ReviewDecisionResponse>(c, result);
    } catch (error) {
      return handleReviewError(c, error, "Review candidate could not be approved.");
    }
  })
  .post("/candidates/bulk-approve", async (c) => {
    const body = await readJsonBody(c.req.raw);
    const ids = parseBulkApproveIds(body.ids);

    if (!ids) {
      return fail(c, "invalid_request", "ids must be a non-empty array.", 400);
    }

    const countError = validateBulkApproveIdCount(ids);
    if (countError) {
      return fail(c, "invalid_request", countError, 400);
    }

    try {
      const explicitPriority = parseOptionalApprovePriority(body.priority);
      const result = await approveCandidatesByIds(c.env, ids, {
        priority: explicitPriority,
        notes: typeof body.notes === "string" ? body.notes : undefined,
        reviewedBy: typeof body.reviewedBy === "string" ? body.reviewedBy : "admin"
      });
      return ok<CandidateBulkApproveResponse>(c, result);
    } catch (error) {
      return handleReviewError(c, error, "Candidates could not be approved.");
    }
  })
  .post("/candidates/bulk-approve-all", async (c) => {
    const body = await readJsonBody(c.req.raw);
    const status = toCandidateStatus(typeof body.status === "string" ? body.status : undefined) ?? "pending_review";

    if (status !== "pending_review") {
      return fail(c, "invalid_request", "bulk-approve-all only supports status pending_review.", 400);
    }

    try {
      const explicitPriority = parseOptionalApprovePriority(body.priority);
      const limit = parseBulkApproveAllLimit(body.limit);
      const candidates = await listAllCandidatesByStatus(c.env, status, limit);
      const ids = candidates.map((candidate) => candidate.id);
      const chunks = chunkIds(ids);
      const parts: CandidateBulkApproveResponse[] = [];

      for (const chunk of chunks) {
        parts.push(
          await approveCandidatesByIds(c.env, chunk, {
            priority: explicitPriority,
            notes: typeof body.notes === "string" ? body.notes : undefined,
            reviewedBy: typeof body.reviewedBy === "string" ? body.reviewedBy : "admin",
            prefetched: candidates
          })
        );
      }

      return ok<CandidateBulkApproveResponse>(c, mergeBulkApproveResults(parts));
    } catch (error) {
      return handleReviewError(c, error, "Candidates could not be approved.");
    }
  })
  .post("/candidates/:id/approve-changes", async (c) => {
    const body = await readJsonBody(c.req.raw);

    try {
      const candidate = await getCandidate(c.env, c.req.param("id"));

      if (!candidate) {
        return fail(c, "candidate_not_found", "That event candidate could not be found.", 404);
      }

      const result = await approveChangesCore(
        c.env,
        candidate,
        buildApproveCandidateOptions({
          eventOverride: body.event,
          priority: parseOptionalApprovePriority(body.priority),
          notes: typeof body.notes === "string" ? body.notes : undefined,
          reviewedBy: typeof body.reviewedBy === "string" ? body.reviewedBy : "admin"
        })
      );

      return ok<ReviewDecisionResponse>(c, result);
    } catch (error) {
      return handleReviewError(c, error, "Candidate changes could not be approved.");
    }
  })
  .post("/candidates/bulk-approve-changes", async (c) => {
    const body = await readJsonBody(c.req.raw);
    const ids = parseBulkApproveChangesIds(body.ids);

    if (!ids) {
      return fail(c, "invalid_request", "ids must be a non-empty array.", 400);
    }

    const countError = validateBulkApproveChangesIdCount(ids);
    if (countError) {
      return fail(c, "invalid_request", countError, 400);
    }

    try {
      const explicitPriority = parseOptionalApprovePriority(body.priority);
      const result = await approveChangesByIds(c.env, ids, {
        priority: explicitPriority,
        notes: typeof body.notes === "string" ? body.notes : undefined,
        reviewedBy: typeof body.reviewedBy === "string" ? body.reviewedBy : "admin"
      });
      return ok<CandidateBulkApproveChangesResponse>(c, result);
    } catch (error) {
      return handleReviewError(c, error, "Candidate changes could not be approved.");
    }
  })
  .post("/candidates/bulk-approve-changes-all", async (c) => {
    const body = await readJsonBody(c.req.raw);

    try {
      const explicitPriority = parseOptionalApprovePriority(body.priority);
      const limit = parseBulkApproveAllLimit(body.limit);
      const candidates = await listAllCandidatesByStatus(c.env, "needs_changes", limit);
      const ids = candidates.map((candidate) => candidate.id);
      const chunks = chunkApproveChangesIds(ids);
      const parts: CandidateBulkApproveChangesResponse[] = [];

      for (const chunk of chunks) {
        parts.push(
          await approveChangesByIds(c.env, chunk, {
            priority: explicitPriority,
            notes: typeof body.notes === "string" ? body.notes : undefined,
            reviewedBy: typeof body.reviewedBy === "string" ? body.reviewedBy : "admin",
            prefetched: candidates
          })
        );
      }

      return ok<CandidateBulkApproveChangesResponse>(c, mergeBulkApproveChangesResults(parts));
    } catch (error) {
      return handleReviewError(c, error, "Candidate changes could not be approved.");
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
  "occurrence_id",
  "canonical_candidate_id",
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

interface ApproveCandidateOptions {
  eventOverride?: unknown;
  priority?: number;
  notes?: string | undefined;
  reviewedBy?: string | undefined;
}

function buildApproveCandidateOptions(input: {
  eventOverride?: unknown;
  priority?: number | undefined;
  notes?: string | undefined;
  reviewedBy?: string | undefined;
}): ApproveCandidateOptions {
  const options: ApproveCandidateOptions = {};
  if (input.eventOverride !== undefined) {
    options.eventOverride = input.eventOverride;
  }
  if (input.priority !== undefined) {
    options.priority = input.priority;
  }
  if (input.notes !== undefined) {
    options.notes = input.notes;
  }
  if (input.reviewedBy !== undefined) {
    options.reviewedBy = input.reviewedBy;
  }
  return options;
}

async function approveCandidateCore(
  env: Env,
  candidate: EventCandidate,
  options: ApproveCandidateOptions
): Promise<ReviewDecisionResponse> {
  if (candidate.status !== "pending_review") {
    throw new ReviewRouteError(`Candidate ${candidate.id} is not pending review.`, 400);
  }

  if (candidate.canonicalCandidateId) {
    throw new ReviewRouteError(
      `Candidate ${candidate.id} is linked to another source; approve the primary row instead.`,
      400
    );
  }

  const priority =
    options.priority !== undefined
      ? options.priority
      : resolveBulkApprovePriority(candidate);

  const siblings = await fetchCandidatesByOccurrenceId(env, candidate.occurrenceId, candidate.id);

  const { event } = await publishCandidateToEvent(env, candidate, {
    eventOverride: options.eventOverride,
    priority,
    reviewedBy: options.reviewedBy ?? "admin",
    siblings
  });

  const updated = await updateCandidate(env, candidate.id, {
    status: "approved",
    review_notes: options.notes ?? candidate.reviewNotes ?? null,
    reviewed_by: options.reviewedBy ?? "admin",
    reviewed_at: new Date().toISOString(),
    matched_event_id: event.id
  });

  await linkOccurrenceSiblings(env, candidate.occurrenceId, event.id, candidate.id);

  return { candidate: updated ?? candidate, event };
}

async function approveChangesCore(
  env: Env,
  candidate: EventCandidate,
  options: ApproveCandidateOptions
): Promise<ReviewDecisionResponse> {
  if (candidate.status !== "needs_changes") {
    throw new ReviewRouteError(`Candidate ${candidate.id} is not needs_changes.`, 400);
  }

  if (candidate.canonicalCandidateId) {
    throw new ReviewRouteError(
      `Candidate ${candidate.id} is linked to another source; update the primary row instead.`,
      400
    );
  }

  if (!candidate.matchedEventId) {
    throw new ReviewRouteError(`Candidate ${candidate.id} has no linked published event.`, 400);
  }

  const published = await getPublishedEventForReview(env, candidate.matchedEventId);
  if (!published) {
    throw new ReviewRouteError(`Published event ${candidate.matchedEventId} could not be found.`, 404);
  }

  const priority =
    options.priority !== undefined
      ? options.priority
      : (published.event.priority ?? EVENT_PRIORITY_DEFAULT);

  const { event } = await publishCandidateToEvent(env, candidate, {
    eventOverride: options.eventOverride,
    priority,
    reviewedBy: options.reviewedBy ?? "admin",
    existingSlug: published.event.slug
  });

  const updated = await updateCandidate(env, candidate.id, {
    status: "approved",
    review_notes: options.notes ?? candidate.reviewNotes ?? null,
    reviewed_by: options.reviewedBy ?? "admin",
    reviewed_at: new Date().toISOString(),
    matched_event_id: event.id
  });

  return { candidate: updated ?? candidate, event };
}

interface PublishCandidateOptions {
  eventOverride?: unknown;
  priority: number;
  reviewedBy: string;
  existingSlug?: string;
  siblings?: EventCandidate[];
}

async function publishCandidateToEvent(
  env: Env,
  candidate: EventCandidate,
  options: PublishCandidateOptions
): Promise<{ event: Event; normalized: NormalizedEvent }> {
  const normalized = mergeNormalizedEvent(candidate.normalizedEvent, options.eventOverride);
  const venue = await upsertVenue(env, normalized);

  const heroImage = normalized.imageUrl
    ? await mirrorImageWithLogging(env, normalized.imageUrl, normalized.title)
    : null;

  const siblings = options.siblings ?? [];
  const existingByOccurrence = await getScheduledEventByOccurrenceId(env, candidate.occurrenceId);

  const event = existingByOccurrence
    ? await patchApprovedEvent(
        env,
        existingByOccurrence,
        candidate,
        normalized,
        venue.id,
        heroImage?.id ?? null,
        options.priority,
        siblings
      )
    : await upsertEvent(
        env,
        candidate,
        normalized,
        venue.id,
        heroImage?.id ?? null,
        options.priority,
        options.existingSlug,
        siblings
      );

  return { event, normalized };
}

interface BulkApproveChangesRunOptions {
  priority?: number | undefined;
  notes?: string | undefined;
  reviewedBy?: string | undefined;
  prefetched?: EventCandidate[] | undefined;
}

async function approveChangesByIds(
  env: Env,
  ids: string[],
  options: BulkApproveChangesRunOptions
): Promise<CandidateBulkApproveChangesResponse> {
  const uniqueIds = [...new Set(ids)];
  const candidateById = new Map(
    (options.prefetched ?? []).map((candidate) => [candidate.id, candidate] as const)
  );
  const missingIds = uniqueIds.filter((id) => !candidateById.has(id));

  if (missingIds.length > 0) {
    const params = new URLSearchParams({
      select: candidateSelect,
      id: `in.(${missingIds.join(",")})`
    });
    const rows = await supabaseRequest<SupabaseCandidateRow[]>(env, `/rest/v1/event_candidates?${params}`);
    for (const row of rows) {
      const mapped = mapCandidateRow(row);
      candidateById.set(mapped.id, mapped);
    }
  }

  const statusRows = uniqueIds.flatMap((id) => {
    const candidate = candidateById.get(id);
    return candidate
      ? [{ id, status: candidate.status, matched_event_id: candidate.matchedEventId ?? null }]
      : [];
  });
  const { toApprove, skipped } = partitionCandidatesForApproveChanges(uniqueIds, statusRows);

  let approved = 0;
  const failed: CandidateBulkApproveChangesResponse["failed"] = [];

  for (const id of toApprove) {
    const candidate = candidateById.get(id);
    if (!candidate) {
      continue;
    }

    try {
      await approveChangesCore(
        env,
        candidate,
        buildApproveCandidateOptions({
          priority: options.priority,
          notes: options.notes,
          reviewedBy: options.reviewedBy
        })
      );
      approved += 1;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      failed.push({ id, message });
      logError("bulk_approve_changes_item_failed", error, {
        candidate_id: id,
        title: candidate.title,
        source: candidate.source,
        source_event_id: candidate.sourceEventId
      });
    }
  }

  if (failed.length > 0 || approved > 0) {
    logStructured("bulk_approve_changes_batch_done", {
      approved,
      skipped: skipped.length,
      failed: failed.length,
      failed_ids: failed.map((f) => f.id)
    });
  }

  return { approved, skipped, failed };
}

interface BulkApproveRunOptions {
  priority?: number | undefined;
  notes?: string | undefined;
  reviewedBy?: string | undefined;
  prefetched?: EventCandidate[] | undefined;
}

async function approveCandidatesByIds(
  env: Env,
  ids: string[],
  options: BulkApproveRunOptions
): Promise<CandidateBulkApproveResponse> {
  const uniqueIds = [...new Set(ids)];
  const candidateById = new Map(
    (options.prefetched ?? []).map((candidate) => [candidate.id, candidate] as const)
  );
  const missingIds = uniqueIds.filter((id) => !candidateById.has(id));

  if (missingIds.length > 0) {
    const params = new URLSearchParams({
      select: candidateSelect,
      id: `in.(${missingIds.join(",")})`
    });
    const rows = await supabaseRequest<SupabaseCandidateRow[]>(env, `/rest/v1/event_candidates?${params}`);
    for (const row of rows) {
      const mapped = mapCandidateRow(row);
      candidateById.set(mapped.id, mapped);
    }
  }

  const statusRows = uniqueIds.flatMap((id) => {
    const candidate = candidateById.get(id);
    return candidate ? [{ id, status: candidate.status }] : [];
  });
  const { toApprove, skipped } = partitionCandidatesForApprove(uniqueIds, statusRows);

  let approved = 0;
  const failed: CandidateBulkApproveResponse["failed"] = [];

  for (const id of toApprove) {
    const candidate = candidateById.get(id);
    if (!candidate) {
      continue;
    }

    try {
      const priority =
        options.priority !== undefined
          ? options.priority
          : resolveBulkApprovePriority(candidate);
      await approveCandidateCore(env, candidate, {
        priority,
        notes: options.notes,
        reviewedBy: options.reviewedBy
      });
      approved += 1;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      failed.push({ id, message });
      logError("bulk_approve_item_failed", error, {
        candidate_id: id,
        title: candidate.title,
        source: candidate.source,
        source_event_id: candidate.sourceEventId
      });
    }
  }

  if (failed.length > 0 || approved > 0) {
    logStructured("bulk_approve_batch_done", {
      approved,
      skipped: skipped.length,
      failed: failed.length,
      failed_ids: failed.map((f) => f.id)
    });
  }

  return { approved, skipped, failed };
}

async function listAllCandidatesByStatus(
  env: Env,
  status: EventCandidateStatus,
  maxLimit?: number
): Promise<EventCandidate[]> {
  const pageSize = 500;
  const all: EventCandidate[] = [];
  let offset = 0;

  while (true) {
    const params = new URLSearchParams({
      select: candidateSelect,
      status: `eq.${status}`,
      order: "created_at.asc",
      limit: String(pageSize),
      offset: String(offset)
    });
    if (status === "pending_review") {
      params.set("canonical_candidate_id", "is.null");
    }
    const rows = await supabaseRequest<SupabaseCandidateRow[]>(env, `/rest/v1/event_candidates?${params}`);

    if (rows.length === 0) {
      break;
    }

    all.push(...rows.map(mapCandidateRow));

    if (maxLimit !== undefined && all.length >= maxLimit) {
      return all.slice(0, maxLimit);
    }

    if (rows.length < pageSize) {
      break;
    }

    offset += pageSize;
  }

  return all;
}

function parseOptionalApprovePriority(value: unknown): number | undefined {
  if (value === undefined) {
    return undefined;
  }

  if (typeof value !== "number" || !Number.isInteger(value) || value < EVENT_PRIORITY_MIN || value > EVENT_PRIORITY_MAX) {
    throw new ReviewRouteError("priority must be an integer 0–5.", 400);
  }

  return value;
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
  priority: number,
  existingSlug?: string,
  siblings: EventCandidate[] = []
): Promise<Event> {
  const slug = existingSlug ?? slugify(`${normalized.title}-${candidate.id.slice(0, 8)}`);
  return await postApprovedEvent(env, candidate, normalized, venueId, heroImageId, priority, slug, siblings);
}

async function postApprovedEvent(
  env: Env,
  candidate: EventCandidate,
  normalized: NormalizedEvent,
  venueId: string,
  heroImageId: string | null,
  priority: number,
  slug: string,
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
  const rows = await supabaseRequest<SupabaseEventRow[]>(env, "/rest/v1/events?on_conflict=source,source_event_id", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Prefer: "resolution=merge-duplicates,return=representation"
    },
    body: JSON.stringify({
      slug,
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
      occurrence_id: candidate.occurrenceId,
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
    const err = new ReviewRouteError(
      `Supabase review query failed with ${response.status}: ${body}`,
      response.status === 401 ? 503 : 502
    );
    logError("supabase_review_request_failed", err, { path, status: response.status });
    throw err;
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
    ...(row.matched_event_id ? { matchedEventId: row.matched_event_id } : {}),
    occurrenceId: row.occurrence_id,
    ...(row.canonical_candidate_id ? { canonicalCandidateId: row.canonical_candidate_id } : {})
  };
}

async function fetchCandidatesByOccurrenceId(
  env: Env,
  occurrenceId: string,
  excludeId?: string
): Promise<EventCandidate[]> {
  const params = new URLSearchParams({
    select: candidateSelect,
    occurrence_id: `eq.${occurrenceId}`,
    order: "source.asc",
    limit: "50"
  });

  const rows = await supabaseRequest<SupabaseCandidateRow[]>(env, `/rest/v1/event_candidates?${params}`);
  return rows
    .filter((row) => row.id !== excludeId)
    .map(mapCandidateRow);
}

async function getScheduledEventByOccurrenceId(env: Env, occurrenceId: string): Promise<SupabaseEventRow | null> {
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

  const rows = await supabaseRequest<SupabaseEventRow[]>(env, `/rest/v1/events?${params}`);
  return rows[0] ?? null;
}

async function patchApprovedEvent(
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
  const rows = await supabaseRequest<SupabaseEventRow[]>(env, `/rest/v1/events?${params}`, {
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
      ticket_url: normalized.ticketUrl ?? null,
      external_url: normalized.externalUrl ?? candidate.sourceUrl ?? null,
      hero_image_id: heroImageId,
      priority,
      occurrence_id: candidate.occurrenceId,
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

async function linkOccurrenceSiblings(env: Env, occurrenceId: string, eventId: string, primaryId: string) {
  const params = new URLSearchParams({
    occurrence_id: `eq.${occurrenceId}`,
    id: `neq.${primaryId}`
  });

  await supabaseRequest(env, `/rest/v1/event_candidates?${params}`, {
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

  return Math.min(Math.max(Math.trunc(parsed), 1), 200);
}

function parseOffset(value: string | undefined) {
  const parsed = Number(value ?? 0);

  if (!Number.isFinite(parsed) || parsed < 0) {
    return 0;
  }

  return Math.min(Math.trunc(parsed), 5000);
}

async function getPublishedEventForReview(env: Env, eventId: string) {
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

  const rows = await supabaseRequest<SupabaseEventWithVenueRow[]>(env, `/rest/v1/events?${params}`);
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
      ...(row.venue?.address ? { venueAddress: row.venue.address } : {})
    }
  };
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
    logError("image_mirror_failed", error, { image_url: imageUrl });
    return null;
  }
}

function handleReviewError(c: Parameters<typeof fail>[0], error: unknown, fallbackMessage: string) {
  logError("review_route_error", error, {
    path: c.req.path,
    method: c.req.method,
    fallback_message: fallbackMessage
  });

  if (error instanceof ReviewRouteError) {
    const status = error.status === 503 ? 503 : error.status === 400 ? 400 : error.status === 404 ? 404 : 502;
    return fail(c, "review_unavailable", error.message, status);
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
  occurrence_id: string;
  canonical_candidate_id: string | null;
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
  category: string;
  subcategories: string[] | null;
  tags: string[] | null;
  price_min: number | string | null;
  price_max: number | string | null;
  currency: string | null;
  is_free: boolean | null;
  ticket_url: string | null;
  external_url: string | null;
  status: string | null;
  gallery_image_ids: string[] | null;
  all_artist_ids: string[] | null;
  dedupe_hash: string | null;
  confidence_score: number | null;
  last_seen_at: string | null;
  priority: number | null;
  series_id: string | null;
  series_name: string | null;
  lineup: unknown;
  occurrence_id: string | null;
  created_at: string;
  updated_at: string;
  venue?: {
    name: string;
    city: string;
    address: string | null;
  } | null;
}

type SupabaseEventWithVenueRow = SupabaseEventRow;
