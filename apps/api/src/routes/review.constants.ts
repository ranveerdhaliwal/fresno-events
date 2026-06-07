import type { EventCandidateStatus } from "@fresno-events/shared";

export const validCandidateStatuses: EventCandidateStatus[] = [
  "awaiting_enrichment",
  "pending_review",
  "approved",
  "rejected",
  "needs_changes",
  "duplicate"
];

export const candidateSelect = [
  "id",
  "run_id",
  "source",
  "source_event_id",
  "title",
  "venue_name",
  "start_ts",
  "source_url",
  "ticket_url",
  "detail_status",
  "detail_page_url",
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
  "occurrence_key",
  "canonical_candidate_id",
  "created_at",
  "updated_at"
].join(",");
