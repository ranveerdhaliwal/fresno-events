import type {
  EventCandidate,
  ReviewQueueAuditIssue,
  ReviewQueueAuditResponse
} from "@fresno-events/shared";
import { eventContentSignature } from "@fresno-events/shared";

import { auditSlugCollisions } from "@/routes/review-slug-audit.utils";

export interface LinkedDuplicateRow {
  id: string;
  title: string;
  canonicalCandidateId: string;
}

export interface ScheduledEventAuditRow {
  id: string;
  slug: string;
  occurrenceId: string | null;
  title: string;
  startTs: string;
  venueName: string;
}

export interface ReviewQueueAuditInput {
  primaries: EventCandidate[];
  linkedDuplicates: LinkedDuplicateRow[];
  scheduledEvents: ScheduledEventAuditRow[];
  generatedAt?: string;
}

function hasAiEnrichmentNotes(reviewNotes: string | null | undefined): boolean {
  return reviewNotes?.trimStart().startsWith("[ai]") ?? false;
}

export function buildReviewQueueAudit(input: ReviewQueueAuditInput): ReviewQueueAuditResponse {
  const issues: ReviewQueueAuditIssue[] = [];
  const scheduledOccurrenceIds = new Set(
    input.scheduledEvents
      .map((event) => event.occurrenceId)
      .filter((id): id is string => Boolean(id))
  );
  const existingSlugs = input.scheduledEvents.map((event) => event.slug);

  const slugCollisions = auditSlugCollisions(
    input.primaries.map((row) => ({
      id: row.id,
      title: row.title,
      startTs: row.startTs,
      occurrenceId: row.occurrenceId
    })),
    existingSlugs,
    scheduledOccurrenceIds
  );

  for (const collision of slugCollisions) {
    issues.push({
      code:
        collision.reason === "existing_event" ? "slug_conflict_published" : "slug_conflict_pending_peer",
      severity: "error",
      candidateId: collision.candidateId,
      title: collision.title,
      message:
        collision.reason === "existing_event"
          ? `Approve would 409: slug "${collision.slug}" is already published.`
          : `Two pending primaries would publish the same slug "${collision.slug}".`,
      detail: {
        slug: collision.slug,
        startTs: collision.startTs,
        conflictsWith: collision.conflictsWith
      }
    });
  }

  for (const row of input.linkedDuplicates) {
    issues.push({
      code: "pending_linked_duplicate",
      severity: "error",
      candidateId: row.id,
      title: row.title,
      message: "Row is pending_review but linked as a duplicate — approve the primary instead.",
      detail: { canonicalCandidateId: row.canonicalCandidateId }
    });
  }

  const primariesByOccurrence = new Map<string, EventCandidate[]>();
  for (const row of input.primaries) {
    if (!row.occurrenceId) {
      continue;
    }
    const bucket = primariesByOccurrence.get(row.occurrenceId) ?? [];
    bucket.push(row);
    primariesByOccurrence.set(row.occurrenceId, bucket);
  }

  for (const [occurrenceId, rows] of primariesByOccurrence) {
    if (rows.length <= 1) {
      continue;
    }
    for (const row of rows.slice(1)) {
      issues.push({
        code: "multi_primary_occurrence",
        severity: "error",
        candidateId: row.id,
        title: row.title,
        message: `${rows.length} pending primaries share occurrence_id — run relink before bulk approve.`,
        detail: {
          occurrenceId,
          primaryCandidateId: rows[0]?.id ?? ""
        }
      });
    }
  }

  const scheduledByContent = new Map<string, ScheduledEventAuditRow[]>();
  for (const event of input.scheduledEvents) {
    const signature = eventContentSignature({
      event: { title: event.title, startTs: event.startTs },
      venue: { name: event.venueName }
    });
    const bucket = scheduledByContent.get(signature) ?? [];
    bucket.push(event);
    scheduledByContent.set(signature, bucket);
  }

  for (const row of input.primaries) {
    const signature = eventContentSignature({
      event: { title: row.title, startTs: row.startTs },
      venue: { name: row.venueName }
    });
    const publishedMatches = scheduledByContent.get(signature) ?? [];
    if (publishedMatches.length === 0) {
      continue;
    }

    const hasSameOccurrence = publishedMatches.some((event) => event.occurrenceId === row.occurrenceId);
    if (hasSameOccurrence) {
      continue;
    }

    const existing = publishedMatches[0]!;
    issues.push({
      code: "published_content_duplicate",
      severity: "error",
      candidateId: row.id,
      title: row.title,
      message:
        "A scheduled event already exists for this show (different occurrence_id). Approve will patch the existing row, or run published-orphan cleanup first.",
      detail: {
        existingEventId: existing.id,
        existingSlug: existing.slug,
        existingOccurrenceId: existing.occurrenceId ?? "",
        candidateOccurrenceId: row.occurrenceId
      }
    });
  }

  for (const row of input.primaries) {
    if (row.source !== "ticketmaster" || hasAiEnrichmentNotes(row.reviewNotes)) {
      continue;
    }
    issues.push({
      code: "ticketmaster_needs_ai",
      severity: "warn",
      candidateId: row.id,
      title: row.title,
      message:
        "Ticketmaster row has no [ai] review notes — priority may default to P5 until enrichment runs.",
      detail: {
        suggestedPriority: String(row.suggestedPriority ?? ""),
        sourceEventId: row.sourceEventId
      }
    });
  }

  const errors = issues.filter((issue) => issue.severity === "error").length;
  const warnings = issues.filter((issue) => issue.severity === "warn").length;

  return {
    generatedAt: input.generatedAt ?? new Date().toISOString(),
    summary: {
      pendingPrimaries: input.primaries.length,
      scheduledEvents: input.scheduledEvents.length,
      errors,
      warnings
    },
    issues
  };
}

export function formatReviewQueueAuditForLog(audit: ReviewQueueAuditResponse): string {
  const lines = [
    `Pre-approve audit — ${audit.summary.pendingPrimaries} pending primaries, ${audit.summary.scheduledEvents} scheduled events`,
    `Errors: ${audit.summary.errors}, warnings: ${audit.summary.warnings}`
  ];

  if (audit.issues.length === 0) {
    lines.push("No blocking issues found.");
    return lines.join("\n");
  }

  for (const issue of audit.issues) {
    lines.push(
      `[${issue.severity}] ${issue.code} ${issue.candidateId} — ${issue.title}: ${issue.message}`
    );
  }

  return lines.join("\n");
}
