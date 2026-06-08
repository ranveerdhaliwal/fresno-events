import { Hono } from "hono";

import {
  type Event,
  type EventCandidateDetailResponse,
  type EventCandidateListResponse,
  type CandidateBulkApproveResponse,
  type CandidateBulkApproveChangesResponse,
  type CandidateBulkDeleteResponse,
  type CandidateBulkPriorityResponse,
  type CandidateBulkRejectResponse,
  type ReviewDecisionResponse,
  type ReviewOccurrenceRelinkOpsResponse,
  type ReviewPriorityTriageOpsResponse,
  type ReviewQueueAuditResponse,
  type ReviewVenueAddressBackfillOpsResponse,
  type ReviewVenueGeocodeOpsResponse
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
  bulkRejectCandidates,
  bulkUpdateSuggestedPriority,
  fetchCandidatesByOccurrenceId,
  getCandidate,
  listAllCandidatesByStatus,
  mapCandidateRow,
  updateCandidate
} from "@/routes/review-candidate.service";
import { candidateSelect } from "@/routes/review.constants";
import { handleReviewError } from "@/routes/review.errors";
import {
  parseBulkRejectIds,
  validateBulkRejectIdCount
} from "@/routes/review-bulk-reject.utils";
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
import {
  linkCandidatesAsSeries,
  resolveSeriesSiblingsForCandidate,
  unlinkCandidateFromSeries
} from "@/routes/review-series-link.utils";
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
import { geocodeAddress } from "@/lib/geocode";
import { runOccurrenceRelinkOps, runVenueAddressBackfillOps } from "@/routes/review-ops.service";
import { runPriorityTriageOps } from "@/routes/review-priority-triage.service";
import { runVenueGeocodeOps } from "@/routes/review-venue-geocode.service";
import { runPreApproveAudit } from "@/routes/review-queue-audit.service";
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
  .get("/candidates/pre-approve-audit", async (c) => {
    try {
      const audit = await runPreApproveAudit(c.env);
      return ok<ReviewQueueAuditResponse>(c, audit);
    } catch (error) {
      return handleReviewError(c, error, "Pre-approve audit could not be run.");
    }
  })
  .post("/ops/occurrence-relink", async (c) => {
    const dryRun = c.req.query("dry_run") === "true";
    try {
      const result = await runOccurrenceRelinkOps(c.env, dryRun);
      return ok<ReviewOccurrenceRelinkOpsResponse>(c, result);
    } catch (error) {
      return handleReviewError(c, error, "Occurrence relink could not be run.");
    }
  })
  .post("/ops/venue-address-backfill", async (c) => {
    const dryRun = c.req.query("dry_run") === "true";
    const source = c.req.query("source") ?? undefined;
    try {
      const result = await runVenueAddressBackfillOps(c.env, dryRun, source);
      return ok<ReviewVenueAddressBackfillOpsResponse>(c, result);
    } catch (error) {
      return handleReviewError(c, error, "Venue address cleanup could not be run.");
    }
  })
  .post("/ops/priority-triage", async (c) => {
    const dryRun = c.req.query("dry_run") === "true";
    const source = c.req.query("source") ?? undefined;
    try {
      const result = await runPriorityTriageOps(c.env, {
        dryRun,
        ...(source ? { sourceFilter: source } : {})
      });
      return ok<ReviewPriorityTriageOpsResponse>(c, result);
    } catch (error) {
      return handleReviewError(c, error, "Priority triage could not be run.");
    }
  })
  .post("/ops/venue-geocode", async (c) => {
    const dryRun = c.req.query("dry_run") === "true";
    try {
      const result = await runVenueGeocodeOps(c.env, dryRun);
      return ok<ReviewVenueGeocodeOpsResponse>(c, result);
    } catch (error) {
      return handleReviewError(c, error, "Venue geocode could not be run.");
    }
  })
  .get("/geocode", async (c) => {
    const address = c.req.query("address") ?? "";
    const city = c.req.query("city") ?? "";
    try {
      const result = await geocodeAddress(c.env, { address, city });
      if (!result) {
        return fail(c, "geocode_not_found", "No coordinates found for that address.", 404);
      }
      return ok(c, result);
    } catch (error) {
      return handleReviewError(c, error, "Geocode request failed.");
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

      const siblings = await fetchCandidatesByOccurrenceId(
        c.env,
        candidate.occurrenceId,
        candidate.id,
        candidate.occurrenceKey
      );
      const linkedCandidates = siblings.map(toLinkedCandidate);

      const seriesSiblings = await resolveSeriesSiblingsForCandidate(c.env, candidate);

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
  .post("/candidates/:id/series-link", async (c) => {
    const body = await readJsonBody(c.req.raw);
    const otherCandidateId =
      typeof body.otherCandidateId === "string" ? body.otherCandidateId.trim() : "";

    if (!otherCandidateId) {
      return fail(c, "invalid_body", "otherCandidateId is required.", 400);
    }

    try {
      const result = await linkCandidatesAsSeries(c.env, c.req.param("id"), otherCandidateId);
      const seriesSiblings = await resolveSeriesSiblingsForCandidate(c.env, result.primary);

      return ok<EventCandidateDetailResponse>(c, {
        candidate: result.primary,
        ...(seriesSiblings.length > 0 ? { seriesSiblings } : {})
      });
    } catch (error) {
      return handleReviewError(c, error, "Candidates could not be linked as a series.");
    }
  })
  .post("/candidates/:id/series-unlink", async (c) => {
    const body = await readJsonBody(c.req.raw);
    const unlinkCandidateId =
      typeof body.candidateId === "string" ? body.candidateId.trim() : "";

    if (!unlinkCandidateId) {
      return fail(c, "invalid_body", "candidateId is required.", 400);
    }

    try {
      await unlinkCandidateFromSeries(c.env, unlinkCandidateId);
      const primary = await getCandidate(c.env, c.req.param("id"));
      if (!primary) {
        return fail(c, "candidate_not_found", "That event candidate could not be found.", 404);
      }

      const seriesSiblings = await resolveSeriesSiblingsForCandidate(c.env, primary);

      return ok<EventCandidateDetailResponse>(c, {
        candidate: primary,
        ...(seriesSiblings.length > 0 ? { seriesSiblings } : {})
      });
    } catch (error) {
      return handleReviewError(c, error, "Series link could not be removed.");
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
  })
  .post("/candidates/bulk-priority", async (c) => {
    const body = await readJsonBody(c.req.raw);
    const ids = Array.isArray(body.ids)
      ? body.ids.filter((id): id is string => typeof id === "string" && id.length > 0)
      : [];
    const priority = parseOptionalApprovePriority(body.priority);

    if (ids.length === 0) {
      return fail(c, "invalid_request", "ids must be a non-empty array.", 400);
    }

    if (ids.length > 100) {
      return fail(c, "invalid_request", "At most 100 ids per bulk-priority request.", 400);
    }

    if (priority === undefined) {
      return fail(c, "invalid_request", "priority (0–5) is required.", 400);
    }

    try {
      const result = await bulkUpdateSuggestedPriority(c.env, ids, priority);
      return ok<CandidateBulkPriorityResponse>(c, result);
    } catch (error) {
      return handleReviewError(c, error, "Candidate priorities could not be updated.");
    }
  })
  .post("/candidates/bulk-reject", async (c) => {
    const body = await readJsonBody(c.req.raw);
    const ids = parseBulkRejectIds(body.ids);

    if (!ids) {
      return fail(c, "invalid_request", "ids must be a non-empty array.", 400);
    }

    const countError = validateBulkRejectIdCount(ids);
    if (countError) {
      return fail(c, "invalid_request", countError, 400);
    }

    try {
      const result = await bulkRejectCandidates(c.env, ids, {
        notes: typeof body.notes === "string" ? body.notes : undefined,
        reviewedBy: typeof body.reviewedBy === "string" ? body.reviewedBy : "admin-bulk-ui"
      });
      return ok<CandidateBulkRejectResponse>(c, result);
    } catch (error) {
      return handleReviewError(c, error, "Candidates could not be rejected.");
    }
  });
