import type { ReviewQueueAuditResponse } from "@fresno-events/shared";

import type { Env } from "@/env";
import { listAllCandidatesByStatus } from "@/routes/review/candidate.service";
import {
  buildReviewQueueAudit,
  formatReviewQueueAuditForLog,
  type LinkedDuplicateRow,
  type ScheduledEventAuditRow
} from "@/routes/review/queue-audit.utils";
import { supabaseReviewRequest } from "@/routes/review/supabase.utils";
import { logStructured } from "@/lib/structured-log";

interface LinkedDuplicateDbRow {
  id: string;
  title: string;
  canonical_candidate_id: string;
}

interface ScheduledEventDbRow {
  id: string;
  slug: string;
  occurrence_id: string | null;
  title: string;
  start_ts: string;
  venues: { name: string } | { name: string }[] | null;
}

async function fetchPendingLinkedDuplicates(env: Env): Promise<LinkedDuplicateRow[]> {
  const params = new URLSearchParams({
    select: "id,title,canonical_candidate_id",
    status: "eq.pending_review",
    canonical_candidate_id: "not.is.null",
    limit: "1000"
  });

  const rows = await supabaseReviewRequest<LinkedDuplicateDbRow[]>(
    env,
    `/rest/v1/event_candidates?${params}`
  );

  return rows.map((row) => ({
    id: row.id,
    title: row.title,
    canonicalCandidateId: row.canonical_candidate_id
  }));
}

async function fetchScheduledEventsForAudit(env: Env): Promise<ScheduledEventAuditRow[]> {
  const params = new URLSearchParams({
    select: "id,slug,occurrence_id,title,start_ts,venues(name)",
    status: "eq.scheduled",
    limit: "5000"
  });

  const rows = await supabaseReviewRequest<ScheduledEventDbRow[]>(env, `/rest/v1/events?${params}`);

  return rows.map((row) => ({
    id: row.id,
    slug: row.slug,
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
