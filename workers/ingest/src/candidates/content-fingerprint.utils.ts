import type { EventCandidateStatus, NormalizedEvent } from "@fresno-events/shared";

export interface ExistingCandidateRow {
  id: string;
  source: string;
  source_event_id: string;
  status: EventCandidateStatus;
  content_fingerprint: string | null;
  matched_event_id: string | null;
  occurrence_id: string | null;
  canonical_candidate_id: string | null;
  reviewed_at: string | null;
  reviewed_by: string | null;
  review_notes: string | null;
  title: string;
  start_ts: string;
  venue_name: string;
  normalized_event: NormalizedEvent;
}

/** Stable fields for “did the source change?” — excludes run metadata and confidence. */
export function fingerprintPayload(event: NormalizedEvent): string {
  return JSON.stringify({
    title: event.title.trim(),
    venueName: event.venueName.trim(),
    startTs: event.startTs,
    endTs: event.endTs ?? null,
    descriptionText: event.descriptionText?.trim() ?? null,
    venueAddress: event.venueAddress?.trim() ?? null,
    venueCity: event.venueCity?.trim() ?? null,
    ticketUrl: event.ticketUrl?.trim() ?? null,
    externalUrl: event.externalUrl?.trim() ?? null,
    category: event.category ?? null
  });
}

export async function contentFingerprint(event: NormalizedEvent): Promise<string> {
  return sha256Hex(fingerprintPayload(event));
}

export function resolveStatusOnRescrape(
  existing: ExistingCandidateRow | undefined,
  newFingerprint: string
): EventCandidateStatus {
  if (!existing) {
    return "awaiting_enrichment";
  }

  if (existing.content_fingerprint === newFingerprint) {
    return existing.status;
  }

  if (existing.status === "approved" && existing.matched_event_id) {
    return "needs_changes";
  }

  if (existing.status === "duplicate") {
    return "duplicate";
  }

  if (existing.status === "awaiting_enrichment") {
    return "awaiting_enrichment";
  }

  return "pending_review";
}

export function fingerprintChanged(
  existing: ExistingCandidateRow | undefined,
  newFingerprint: string
): boolean {
  if (!existing?.content_fingerprint) {
    return true;
  }
  return existing.content_fingerprint !== newFingerprint;
}

async function sha256Hex(value: string) {
  const buffer = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return [...new Uint8Array(buffer)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}
