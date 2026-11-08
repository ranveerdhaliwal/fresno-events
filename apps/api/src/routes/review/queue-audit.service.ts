import type { ReviewQueueAuditResponse } from "@fresno-events/shared";

import type { Env } from "@/env";
import { listAllCandidatesByStatus } from "@/routes/review/candidate.service";
import {
  buildReviewQueueAudit,
  formatReviewQueueAuditForLog,
  type LinkedDuplicateRow,
  type ScheduledEventAuditRow
} from "@/routes/review/queue-audit.utils";
import { fetchAllReviewRows } from "@/routes/review/fetch-all-review-rows.utils";
import { logStructured } from "@/lib/structured-log";

interface LinkedDuplicateDbRow {
  id: string;
  title: string;
  canonical_candidate_id: string;
}

interface ScheduledEventDbRow {
  source_event_id: string | null;
  id: string;
  slug: string;
  occurrence_id: string | null;
  title: string;
  start_ts: string;
  venues: { name: string } | { name: string }[] | null;
}

async function fetchPendingLinkedDuplicates(env: Env): Promise<LinkedDuplicateRow[]> {
  const rows = await fetchAllReviewRows<LinkedDuplicateDbRow>(env, "event_candidates", {
    select: "id,title,canonical_candidate_id",
    status: "eq.pending_review",
    canonical_candidate_id: "not.is.null"
  });

  return rows.map((row) => ({
    id: row.id,
    title: row.title,
    canonicalCandidateId: row.canonical_candidate_id
  }));
}

async function fetchScheduledEventsForAudit(env: Env): Promise<ScheduledEventAuditRow[]> {
  const rows = await fetchAllReviewRows<ScheduledEventDbRow>(env, "events", {
    select: "id,slug,occurrence_id,title,start_ts,source_event_id,venues(name)",
    status: "eq.scheduled"
  });

  return rows.map((row) => ({
    id: row.id,
    slug: row.slug,
    ...(row.source_event_id ? { sourceEventId: row.source_event_id } : {}),
    occurrenceId: row.occurrence_id,
    title: row.title,
    startTs: row.start_ts,
    venueName: Array.isArray(row.venues) ? (row.venues[0]?.name ?? "") : (row.venues?.name ?? "")
  }));
}

export async function runPreApproveAudit(env: Env): Promise<ReviewQueueAuditResponse> {
  const [primaries, linkedDuplicates, scheduledEvents] = await Promise.all([
    listAllCandidatesByStatus(env, "pending_review"),
    fetchPendingLinkedDuplicates(env),
    fetchScheduledEventsForAudit(env)
  ]);

  const audit = buildReviewQueueAudit({
    primaries,
    linkedDuplicates,
    scheduledEvents,
    generatedAt: new Date().toISOString()
  });

  logStructured("review_pre_approve_audit", {
    ...audit.summary,
    issue_count: audit.issues.length,
    log: formatReviewQueueAuditForLog(audit)
  });

  return audit;
}
