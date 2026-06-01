import { Hono } from "hono";

import {
  type Event,
  type EventCandidateDetailResponse,
  type EventCandidateListResponse,
  type CandidateBulkApproveResponse,
  type CandidateBulkApproveChangesResponse,
  type CandidateBulkDeleteResponse,
  type ReviewDecisionResponse
} from "@fresno-events/shared";

import type { Env } from "@/env";
import { fail, ok } from "@/lib/responses";
import {
  chunkIds,
  mergeBulkApproveResults,
  parseBulkApproveAllLimit,
  parseBulkApproveIds,
  validateBulkApproveIdCount
} from "@/routes/review-approve.utils";
import { requireReviewAuth } from "@/routes/review-auth.utils";
import {
  deleteCandidates,
  fetchCandidatesByOccurrenceId,
  fetchCandidatesBySeriesId,
  getCandidate,
  listAllCandidatesByStatus,
  mapCandidateRow,
  updateCandidate
} from "@/routes/review-candidate.service";
import { candidateSelect } from "@/routes/review.constants";
import { handleReviewError } from "@/routes/review.errors";
import { buildContentDiff } from "@/routes/review-diff.utils";
import {
  parseApprovePriority,
  parseLimit,
  parseOffset,
  parseOptionalApprovePriority,
  readJsonBody,
  toCandidateStatus
} from "@/routes/review-mappers.utils";
import { toLinkedCandidate } from "@/routes/review-occurrence.utils";
import { toSeriesSiblingCandidate } from "@/routes/review-series.utils";
import {
  approveCandidateCore,
  approveCandidatesByIds,
  approveChangesByIds,
  approveChangesCore,
  buildApproveCandidateOptions
} from "@/routes/review-publish.utils";
import {
  chunkApproveChangesIds,
  mergeBulkApproveChangesResults,
  parseBulkApproveChangesIds,
  validateBulkApproveChangesIdCount
} from "@/routes/review-approve-changes.utils";
import { getPublishedEventForReview } from "@/routes/review-event.service";
import { supabaseReviewRequest } from "@/routes/review-supabase.utils";
import type { SupabaseCandidateRow } from "@/routes/review.types";

export { requireReviewAuth } from "@/routes/review-auth.utils";

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
      const rows = await supabaseReviewRequest<SupabaseCandidateRow[]>(
        c.env,
        `/rest/v1/event_candidates?${params}`
      );
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

      const seriesId = candidate.normalizedEvent.seriesId;
      const seriesSiblings = seriesId
        ? (await fetchCandidatesBySeriesId(c.env, seriesId, candidate.id)).map(toSeriesSiblingCandidate)
        : [];

      return ok<EventCandidateDetailResponse>(c, {
        candidate,
        ...(linkedCandidates.length > 0 ? { linkedCandidates } : {}),
        ...(seriesSiblings.length > 0 ? { seriesSiblings } : {}),
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
