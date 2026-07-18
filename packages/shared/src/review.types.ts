import type { Event, EventSource } from "./event.types.js";
import type { NormalizedEvent } from "./ingest.types.js";

export type EventCandidateStatus =
  | "awaiting_enrichment"
  | "pending_review"
  | "approved"
  | "rejected"
  | "needs_changes"
  | "duplicate";

export interface LinkedEventCandidate {
  id: string;
  source: EventSource;
  sourceEventId: string;
  title: string;
  status: EventCandidateStatus;
  sourceUrl?: string;
  ticketUrl?: string;
}

/** Same night + venue, high title overlap, but not linked as duplicate yet. */
export interface NearMatchCandidate extends LinkedEventCandidate {
  titleSimilarityScore: number;
  sharedWordCount: number;
  similarityLabel: string;
  sharedWords: string[];
}

export interface SeriesSiblingCandidate {
  id: string;
  source: EventSource;
  sourceEventId: string;
  title: string;
  startTs: string;
  venueName: string;
  status: EventCandidateStatus;
  sourceUrl?: string;
}

/** Whether ingest has enough structured fields, or detail_page_url still needs a fetch. */
export type CandidateDetailStatus = "complete" | "pending";

/** Eventbrite ticket-page detail enrichment state (description from __NEXT_DATA__). */
export type EventbriteDetailStatus = "fetched" | "blocked" | "error";

export interface EventCandidate {
  id: string;
  runId?: string;
  source: EventSource;
  sourceEventId: string;
  title: string;
  venueName: string;
  startTs: string;
  sourceUrl?: string;
  ticketUrl?: string;
  detailStatus: CandidateDetailStatus;
  /** Canonical show/detail URL for backfill when detailStatus is pending. */
  detailPageUrl?: string;
  /** Set when ticket/external URL is Eventbrite; null = detail page not yet fetched. */
  eventbriteDetailStatus?: EventbriteDetailStatus | null;
  normalizedEvent: NormalizedEvent;
  rawPayload: Record<string, unknown>;
  dedupeHash: string;
  confidenceScore: number;
  /** 0–5 from AI enrichment; omitted until enriched. */
  suggestedPriority?: number;
  status: EventCandidateStatus;
  reviewNotes?: string;
  reviewedAt?: string;
  reviewedBy?: string;
  matchedEventId?: string;
  /** Live calendar priority when linked to a published event (admin approved tab). */
  publishedPriority?: number;
  /** Mirrored hero from the linked published event when candidate imageUrl is empty. */
  publishedHeroImageUrl?: string;
  occurrenceId: string;
  /** Same-show fingerprint; filters false-positive occurrence_id siblings in admin. */
  occurrenceKey?: string;
  canonicalCandidateId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface EventCandidateListResponse {
  items: EventCandidate[];
  generatedAt: string;
  offset?: number;
  limit?: number;
}

/** Review queue tab totals (admin UI). */
export interface EventCandidateTabCounts {
  pending_review: number;
  needs_changes: number;
  approved: number;
  rejected: number;
}

export type ContentDiffField =
  | "title"
  | "startTs"
  | "endTs"
  | "venueName"
  | "venueCity"
  | "venueAddress"
  | "descriptionText"
  | "ticketUrl"
  | "externalUrl"
  | "category"
  | "priceMin"
  | "priceMax";

export interface ContentDiffEntry {
  field: ContentDiffField;
  label: string;
  before: string | null;
  after: string | null;
}

export interface ContentDiffSummary {
  changedFields: ContentDiffField[];
  entries: ContentDiffEntry[];
}

/** Venue pin shown on publish when the candidate has no coords of its own. */
export interface PublishVenuePreview {
  lat: number;
  lng: number;
  venueName: string;
  venueSlug: string;
  source: "existing_venue";
}

export interface EventCandidateDetailResponse {
  candidate: EventCandidate;
  linkedCandidates?: LinkedEventCandidate[];
  /** High title overlap at same venue/date but different occurrence — not auto-linked. */
  nearMatchCandidates?: NearMatchCandidate[];
  /** When candidate is linked to a canonical row, the primary ingest row for this occurrence. */
  primaryCandidate?: LinkedEventCandidate;
  seriesSiblings?: SeriesSiblingCandidate[];
  publishedEvent?: Event;
  contentDiff?: ContentDiffSummary;
  /** Matches post-approve map when ingest omitted venueLat/Lng but venues row exists. */
  publishVenuePreview?: PublishVenuePreview;
}

export interface ReviewDecisionResponse {
  candidate: EventCandidate;
  event?: Event;
}

export type CandidateDeleteSkipReason = "approved" | "not_found";

export interface CandidateBulkDeleteResponse {
  deleted: number;
  skipped: Array<{ id: string; reason: CandidateDeleteSkipReason }>;
}

export interface CandidateBulkPriorityResponse {
  priority: number;
  updated: number;
  failed: Array<{ id: string; message: string }>;
}

export interface EventBulkPriorityResponse {
  priority: number;
  updated: number;
  failed: Array<{ id: string; message: string }>;
}

export interface CandidateBulkRejectResponse {
  rejected: number;
  failed: Array<{ id: string; message: string }>;
}

export type CandidateApproveSkipReason = "not_found" | "not_pending" | "already_approved";

export interface CandidateBulkApproveResponse {
  approved: number;
  skipped: Array<{ id: string; reason: CandidateApproveSkipReason }>;
  failed: Array<{ id: string; message: string }>;
}

export type CandidateApproveChangesSkipReason =
  | "not_found"
  | "not_needs_changes"
  | "missing_matched_event"
  | "already_approved";

export interface CandidateBulkApproveChangesResponse {
  approved: number;
  skipped: Array<{ id: string; reason: CandidateApproveChangesSkipReason }>;
  failed: Array<{ id: string; message: string }>;
}

export type ReviewQueueAuditSeverity = "error" | "warn";

export type ReviewQueueAuditCode =
  | "slug_conflict_published"
  | "slug_conflict_pending_peer"
  | "pending_linked_duplicate"
  | "multi_primary_occurrence"
  | "published_content_duplicate"
  | "ticketmaster_needs_ai";

export interface ReviewQueueAuditIssue {
  code: ReviewQueueAuditCode;
  severity: ReviewQueueAuditSeverity;
  candidateId: string;
  title: string;
  message: string;
  detail?: Record<string, string>;
}

export interface ReviewQueueAuditResponse {
  generatedAt: string;
  summary: {
    pendingPrimaries: number;
    scheduledEvents: number;
    errors: number;
    warnings: number;
  };
  issues: ReviewQueueAuditIssue[];
}
