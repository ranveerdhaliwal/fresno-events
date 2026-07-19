import type { EventCandidateStatus, EventCategory, NormalizedEvent } from "@fresno-events/shared";
import { sanitizeEventTags } from "@fresno-events/shared";

import { needsDetailBackfill } from "@/candidates/detail-status.utils";

export interface EnrichmentCandidateRow {
  id: string;
  status: EventCandidateStatus;
  normalized_event: NormalizedEvent;
  confidence_score: number;
  review_notes: string | null;
  suggested_priority: number | null;
  matched_event_id?: string | null;
  detail_status?: string | null;
  occurrence_id?: string | null;
  canonical_candidate_id?: string | null;
}

const AI_REVIEW_PREFIX = "[ai]";

/**
 * Confidence assigned when a candidate has enough structured data to review without the LLM.
 * Higher than the pre-enrichment placeholder (see defaultConfidenceScore) so trusted API/scrape
 * sources don't sit at the misleading 0.70 default after skipping enrichment.
 */
export const SUFFICIENT_WITHOUT_LLM_CONFIDENCE = 0.95;

/** PostgREST status filter for enrichment batch fetches (includes pending_review backlog). */
export const ENRICHMENT_QUEUE_STATUSES =
  "in.(awaiting_enrichment,pending_review,needs_changes)" as const;

/** Already ran through post-ingest LLM enrichment. */
export function hasAiEnrichmentNotes(reviewNotes: string | null | undefined): boolean {
  return reviewNotes?.trimStart().startsWith(AI_REVIEW_PREFIX) ?? false;
}

/**
 * Enough structured fields for admin review without calling the enrichment model.
 * Does not require suggested_priority (that is normally set by enrichment).
 */
export function hasSufficientReviewData(event: NormalizedEvent): boolean {
  return (
    Boolean(event.title?.trim()) &&
    Boolean(event.venueName?.trim()) &&
    Boolean(event.startTs) &&
    Boolean(event.category) &&
    Boolean(event.descriptionText?.trim())
  );
}

/** Ticketmaster payloads are often "sufficient" but still need an editorial AI priority pass. */
export function ticketmasterRequiresAiEnrichment(row: EnrichmentCandidateRow): boolean {
  return row.normalized_event.source === "ticketmaster" && !hasAiEnrichmentNotes(row.review_notes);
}

export function candidateNeedsEnrichment(row: EnrichmentCandidateRow): boolean {
  if (isBlockedByPendingDetail(row)) {
    return false;
  }
  if (hasAiEnrichmentNotes(row.review_notes)) {
    return false;
  }
  if (row.status === "needs_changes") {
    // Re-enrich once per source change; promote clears review_notes when content_fingerprint changes.
    return true;
  }
  if (ticketmasterRequiresAiEnrichment(row)) {
    return true;
  }
  if (hasSufficientReviewData(row.normalized_event)) {
    return false;
  }
  return true;
}

/**
 * A sufficient-data row that skipped the LLM should still get a real confidence score.
 * Applies to new (awaiting_enrichment) rows and to pending_review rows whose confidence was
 * reset to the placeholder on a content re-scrape. Rows already enriched ([ai] notes) or already
 * carrying the sufficient score are left untouched to avoid re-write churn each run.
 */
export function needsSufficientConfidenceBackfill(row: EnrichmentCandidateRow): boolean {
  if (hasAiEnrichmentNotes(row.review_notes)) {
    return false;
  }
  return row.confidence_score < SUFFICIENT_WITHOUT_LLM_CONFIDENCE;
}

export function isBlockedByPendingDetail(row: EnrichmentCandidateRow): boolean {
  return row.detail_status === "pending" && needsDetailBackfill(row.normalized_event);
}

/** LLM enrichment output shape (matches AiEnrichment in ai.ts). */
export interface EnrichmentModelResult {
  confidence: number;
  category: EventCategory | null;
  cleaned_title: string | null;
  tags: string[];
  is_junk: boolean;
  reasoning: string;
  suggested_priority: number;
}

export interface EnrichmentFieldDelta {
  title_changed: boolean;
  title_before: string;
  title_after: string;
  category_changed: boolean;
  category_before: string | null;
  category_after: string | null;
  tags_added: string[];
  normalized_event_patched: boolean;
  /** Columns written on event_candidates (always includes confidence, priority, notes). */
  db_fields: string[];
  status_change: string | null;
}

export function summarizeEnrichmentDelta(
  before: NormalizedEvent,
  enrichment: EnrichmentModelResult,
  opts: { autoReject: boolean }
): EnrichmentFieldDelta {
  const dbFields = ["confidence_score", "suggested_priority", "review_notes", "updated_at"];

  let titleAfter = before.title;
  let titleChanged = false;
  if (enrichment.cleaned_title?.trim() && enrichment.cleaned_title.trim() !== before.title.trim()) {
    titleAfter = enrichment.cleaned_title.trim();
    titleChanged = true;
  }

  const categoryBefore = before.category ?? null;
  const categoryAfter = enrichment.category ?? categoryBefore;
  const categoryChanged = Boolean(enrichment.category && enrichment.category !== categoryBefore);

  const mergedTags =
    enrichment.tags.length > 0
      ? sanitizeEventTags([...(before.tags ?? []), ...enrichment.tags])
      : sanitizeEventTags(before.tags ?? []);
  const tagsAdded = sanitizeEventTags(enrichment.tags).filter((t) => !(before.tags ?? []).includes(t));
  const tagsChanged = mergedTags.join("\0") !== (before.tags ?? []).join("\0");

  const normalizedEventPatched = titleChanged || categoryChanged || tagsChanged;

  if (normalizedEventPatched) {
    dbFields.push("normalized_event");
  }
  if (titleChanged) {
    dbFields.push("title");
  }
  if (opts.autoReject) {
    dbFields.push("status", "reviewed_by", "reviewed_at");
  }

  return {
    title_changed: titleChanged,
    title_before: before.title,
    title_after: titleAfter,
    category_changed: categoryChanged,
    category_before: categoryBefore,
    category_after: categoryAfter,
    tags_added: tagsAdded,
    normalized_event_patched: normalizedEventPatched,
    db_fields: dbFields,
    status_change: opts.autoReject ? "pending_review → rejected" : null
  };
}

export function reasoningPreview(reasoning: string, maxLen = 120): string {
  const trimmed = reasoning.trim();
  if (trimmed.length <= maxLen) {
    return trimmed;
  }
  return `${trimmed.slice(0, maxLen)}…`;
}

export function formatEnrichmentDoneLine(
  title: string,
  delta: EnrichmentFieldDelta,
  enrichment: EnrichmentModelResult,
  opts?: { index?: number; total?: number }
): string {
  const progress =
    opts?.index !== undefined && opts?.total !== undefined ? ` ${opts.index}/${opts.total}:` : ":";
  const parts: string[] = [`conf ${enrichment.confidence.toFixed(2)}`, `priority ${enrichment.suggested_priority}`];
  if (enrichment.is_junk) {
    parts.push("rejected as junk");
  }
  if (delta.title_changed) {
    parts.push(`title "${truncateForLog(delta.title_before, 32)}" → "${truncateForLog(delta.title_after, 32)}"`);
  }
  if (delta.category_changed) {
    parts.push(`category ${delta.category_before ?? "?"} → ${delta.category_after}`);
  } else if (delta.category_after) {
    parts.push(`category ${delta.category_after}`);
  }
  if (delta.tags_added.length > 0) {
    parts.push(`tags +${delta.tags_added.length}`);
  }
  const shortTitle = truncateForLog(title, 48);
  return `[ingest] enriched${progress} "${shortTitle}" — ${parts.join(", ")}`;
}

function truncateForLog(text: string, max: number): string {
  if (text.length <= max) {
    return text;
  }
  return `${text.slice(0, max - 1)}…`;
}
