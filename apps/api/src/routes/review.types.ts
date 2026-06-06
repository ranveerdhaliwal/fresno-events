import type { EventCandidate, EventCandidateStatus, NormalizedEvent } from "@fresno-events/shared";

export interface CandidatePatch {
  status?: EventCandidateStatus;
  review_notes?: string | null;
  reviewed_at?: string;
  reviewed_by?: string;
  matched_event_id?: string | null;
  normalized_event?: NormalizedEvent;
  updated_at?: string;
}

export interface SupabaseCandidateRow {
  id: string;
  run_id: string | null;
  source: string;
  source_event_id: string;
  title: string;
  venue_name: string;
  start_ts: string;
  source_url: string | null;
  ticket_url: string | null;
  detail_status: string;
  detail_page_url: string | null;
  normalized_event: unknown;
  raw_payload: unknown;
  dedupe_hash: string;
  confidence_score: number;
  suggested_priority: number | null;
  status: string;
  review_notes: string | null;
  reviewed_at: string | null;
  reviewed_by: string | null;
  matched_event_id: string | null;
  occurrence_id: string;
  canonical_candidate_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface SupabaseVenueRow {
  id: string;
}

export interface SupabaseEventRow {
  id: string;
  slug: string;
  source: string;
  source_event_id: string | null;
  source_refs: unknown;
  title: string;
  description_html: string | null;
  description_text: string | null;
  venue_id: string;
  start_ts: string;
  end_ts: string | null;
  timezone: string | null;
  category: string;
  subcategories: string[] | null;
  tags: string[] | null;
  price_min: number | string | null;
  price_max: number | string | null;
  currency: string | null;
  is_free: boolean | null;
  ticket_url: string | null;
  external_url: string | null;
  status: string | null;
  gallery_image_ids: string[] | null;
  all_artist_ids: string[] | null;
  dedupe_hash: string | null;
  confidence_score: number | null;
  last_seen_at: string | null;
  priority: number | null;
  series_id: string | null;
  series_name: string | null;
  lineup: unknown;
  occurrence_id: string | null;
  created_at: string;
  updated_at: string;
  venue?: {
    name: string;
    city: string;
    address: string | null;
  } | null;
}

export type SupabaseEventWithVenueRow = SupabaseEventRow;

export interface ApproveCandidateOptions {
  eventOverride?: unknown;
  priority?: number;
  notes?: string | undefined;
  reviewedBy?: string | undefined;
}

export interface PublishCandidateOptions {
  eventOverride?: unknown;
  priority: number;
  reviewedBy: string;
  existingSlug?: string;
  siblings?: EventCandidate[];
}

export interface BulkApproveChangesRunOptions {
  priority?: number | undefined;
  notes?: string | undefined;
  reviewedBy?: string | undefined;
  prefetched?: EventCandidate[] | undefined;
}

export interface BulkApproveRunOptions {
  priority?: number | undefined;
  notes?: string | undefined;
  reviewedBy?: string | undefined;
  prefetched?: EventCandidate[] | undefined;
}
