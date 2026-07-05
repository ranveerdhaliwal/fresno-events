import {
  planPublishedOrphanDeletions,
  type PublishedEventAuditRow,
  type ReviewPublishedOrphanOpsResponse
} from "@fresno-events/shared";

import type { Env } from "@/env";
import { logStructured } from "@/lib/structured-log";
import { supabaseReviewRequest } from "@/routes/review-supabase.utils";

interface ScheduledEventDbRow {
  id: string;
  slug: string;
  title: string;
  start_ts: string;
  source: string;
  occurrence_id: string | null;
  venues: { name: string } | { name: string }[] | null;
}

interface CandidateVoteRow {
  matched_event_id: string;
}

function venueNameFromRow(row: ScheduledEventDbRow): string {
  if (Array.isArray(row.venues)) {
    return row.venues[0]?.name ?? "";
  }
  return row.venues?.name ?? "";
}

async function fetchScheduledEventsForOrphanScan(env: Env): Promise<PublishedEventAuditRow[]> {
  const params = new URLSearchParams({
    select: "id,slug,title,start_ts,source,occurrence_id,venues(name)",
    status: "eq.scheduled",
    limit: "5000"
  });

  const rows = await supabaseReviewRequest<ScheduledEventDbRow[]>(env, `/rest/v1/events?${params}`);

  return rows.map((row) => ({
    id: row.id,
    slug: row.slug,
    title: row.title,
    startTs: row.start_ts,
    venueName: venueNameFromRow(row),
    source: row.source,
    occurrenceId: row.occurrence_id
  }));
}

async function fetchCanonicalVotes(env: Env): Promise<Map<string, number>> {
  const params = new URLSearchParams({
    select: "matched_event_id",
    status: "eq.duplicate",
    matched_event_id: "not.is.null",
    limit: "5000"
  });

  const rows = await supabaseReviewRequest<CandidateVoteRow[]>(
    env,
    `/rest/v1/event_candidates?${params}`
  );

  const votes = new Map<string, number>();
  for (const row of rows) {
    votes.set(row.matched_event_id, (votes.get(row.matched_event_id) ?? 0) + 1);
  }
  return votes;
}

function buildPublishedOrphanMessage(
  dryRun: boolean,
  summary: ReviewPublishedOrphanOpsResponse["summary"]
): string {
  if (summary.wouldDelete === 0) {
    return dryRun
      ? "No published content duplicates found."
      : "Published orphan cleanup complete — nothing to delete.";
  }

  const verb = dryRun ? "Would delete" : "Deleted";
  return `${verb} ${summary.deleted || summary.wouldDelete} orphan published event(s) across ${summary.duplicateGroups} duplicate group(s).`;
}

export async function runPublishedOrphanCleanupOps(
  env: Env,
  dryRun: boolean
): Promise<ReviewPublishedOrphanOpsResponse> {
  const [events, canonicalVotes] = await Promise.all([
    fetchScheduledEventsForOrphanScan(env),
    fetchCanonicalVotes(env)
  ]);

  const planned = planPublishedOrphanDeletions(events, canonicalVotes);
  let deleted = 0;
  let errors = 0;

  if (!dryRun) {
    for (const item of planned) {
      try {
        const params = new URLSearchParams({ id: `eq.${item.eventId}` });
        await supabaseReviewRequest(env, `/rest/v1/events?${params}`, { method: "DELETE" });
        deleted += 1;
      } catch (error) {
        errors += 1;
        logStructured("published_orphan_delete_failed", {
          event_id: item.eventId,
          keep_event_id: item.keepEventId,
          error: error instanceof Error ? error.message : String(error)
        });
      }
    }
  }

  const duplicateGroups = new Set(planned.map((item) => item.keepEventId)).size;
  const summary = {
    scheduledScanned: events.length,
    duplicateGroups,
    wouldDelete: planned.length,
    deleted: dryRun ? 0 : deleted,
    errors,
    deletions: planned.map((item) => ({
      eventId: item.eventId,
      slug: item.slug,
      title: item.title,
      keepEventId: item.keepEventId,
      keepSlug: item.keepSlug
    }))
  };

  const response: ReviewPublishedOrphanOpsResponse = {
    dryRun,
    summary,
    message: buildPublishedOrphanMessage(dryRun, summary)
  };

  logStructured("published_orphan_cleanup", {
    dry_run: dryRun,
    ...summary
  });

  return response;
}
