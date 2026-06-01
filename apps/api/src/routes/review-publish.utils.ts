import {
  EVENT_PRIORITY_DEFAULT,
  type CandidateBulkApproveChangesResponse,
  type CandidateBulkApproveResponse,
  type Event,
  type EventCandidate,
  type NormalizedEvent,
  type ReviewDecisionResponse
} from "@fresno-events/shared";

import type { Env } from "@/env";
import { mirrorImageToR2 } from "@/lib/images";
import { logError, logStructured } from "@/lib/structured-log";
import {
  partitionCandidatesForApprove,
  resolveBulkApprovePriority
} from "@/routes/review-approve.utils";
import {
  partitionCandidatesForApproveChanges
} from "@/routes/review-approve-changes.utils";
import {
  fetchCandidatesByOccurrenceId,
  mapCandidateRow,
  updateCandidate
} from "@/routes/review-candidate.service";
import { candidateSelect } from "@/routes/review.constants";
import { ReviewRouteError } from "@/routes/review.errors";
import {
  getPublishedEventForReview,
  getScheduledEventByOccurrenceId,
  linkOccurrenceSiblings,
  patchApprovedEvent,
  upsertEvent,
  upsertVenue
} from "@/routes/review-event.service";
import { buildApproveCandidateOptions, mergeNormalizedEvent } from "@/routes/review-mappers.utils";
import { supabaseReviewRequest } from "@/routes/review-supabase.utils";
import type {
  ApproveCandidateOptions,
  BulkApproveChangesRunOptions,
  BulkApproveRunOptions,
  PublishCandidateOptions,
  SupabaseCandidateRow
} from "@/routes/review.types";

async function mirrorImageWithLogging(env: Env, imageUrl: string, altText: string) {
  try {
    return await mirrorImageToR2(env, imageUrl, altText);
  } catch (error) {
    logError("image_mirror_failed", error, { image_url: imageUrl });
    return null;
  }
}

export async function publishCandidateToEvent(
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

export async function approveCandidateCore(
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
    options.priority !== undefined ? options.priority : resolveBulkApprovePriority(candidate);

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

export async function approveChangesCore(
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

export async function approveChangesByIds(
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
    const rows = await supabaseReviewRequest<SupabaseCandidateRow[]>(
      env,
      `/rest/v1/event_candidates?${params}`
    );
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

export async function approveCandidatesByIds(
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
    const rows = await supabaseReviewRequest<SupabaseCandidateRow[]>(
      env,
      `/rest/v1/event_candidates?${params}`
    );
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
        options.priority !== undefined ? options.priority : resolveBulkApprovePriority(candidate);
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

export { buildApproveCandidateOptions };
