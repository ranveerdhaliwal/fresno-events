import type { EventCandidateStatus, EventCategory, NormalizedEvent } from "@fresno-events/shared";

export interface EnrichmentCandidateRow {
  id: string;
  status: EventCandidateStatus;
  normalized_event: NormalizedEvent;
  confidence_score: number;
  review_notes: string | null;
  suggested_priority: number | null;
  matched_event_id?: string | null;
}

const AI_REVIEW_PREFIX = "[ai]";

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

export function candidateNeedsEnrichment(row: EnrichmentCandidateRow): boolean {
  if (row.status === "needs_changes") {
    return true;
  }
  if (hasAiEnrichmentNotes(row.review_notes)) {
    return false;
  }
  if (hasSufficientReviewData(row.normalized_event)) {
    return false;
  }
  return true;
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
      ? Array.from(new Set([...(before.tags ?? []), ...enrichment.tags]))
      : [...(before.tags ?? [])];
  const tagsAdded = enrichment.tags.filter((t) => !(before.tags ?? []).includes(t));
  const tagsChanged = mergedTags.length !== (before.tags ?? []).length;

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
  enrichment: EnrichmentModelResult
): string {
  const parts: string[] = [`priority ${enrichment.suggested_priority}`];
  if (enrichment.is_junk) {
    parts.push("rejected as junk");
  }
  if (delta.title_changed) {
    parts.push(`title: "${delta.title_before}" → "${delta.title_after}"`);
  } else {
    parts.push("title unchanged");
  }
  if (delta.category_changed) {
    parts.push(`category: ${delta.category_before ?? "?"} → ${delta.category_after}`);
  } else if (delta.category_after) {
    parts.push(`category: ${delta.category_after}`);
  }
  if (delta.tags_added.length > 0) {
    parts.push(`tags +${delta.tags_added.length}`);
  }
  const shortTitle = title.length > 48 ? `${title.slice(0, 48)}…` : title;
  return `[ingest] enriched: "${shortTitle}" — ${parts.join(", ")}`;
}
