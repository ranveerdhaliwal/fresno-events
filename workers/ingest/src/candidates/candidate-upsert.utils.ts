import type { NormalizedEvent } from "@fresno-events/shared";

import { resolveCandidateDetailFields } from "@/candidates/detail-status.utils";
import type { ExistingCandidateRow } from "@/candidates/content-fingerprint.utils";
import type { OccurrencePersistFields } from "@/candidates/occurrence-resolve.utils";
import type { PersistEventAuditKind } from "@/candidates/persist-analysis.utils";

export interface BuildCandidateUpsertRowInput {
  auditKind: PersistEventAuditKind;
  runId: string;
  event: NormalizedEvent;
  fingerprint: string;
  status: string;
  existing?: ExistingCandidateRow;
  contentChanged: boolean;
  occurrence: OccurrencePersistFields;
}

/** Scrape-default confidence before first enrichment (ticketmaster slightly higher). */
export function defaultConfidenceScore(source: string): number {
  return source === "ticketmaster" ? 0.84 : 0.7;
}

/**
 * Changed rows that stay pending_review are not post-promote enriched; reset confidence on upsert.
 * needs_changes / awaiting_enrichment omit confidence so enrichment owns the next score.
 */
export function shouldResetConfidenceOnChangedUpsert(status: string): boolean {
  return status === "pending_review";
}

function legacyDedupeHashInput(event: NormalizedEvent): string {
  return [event.source, event.sourceEventId, event.title, event.venueName, event.startTs].join("|").toLowerCase();
}

export async function buildCandidateUpsertRow(
  input: BuildCandidateUpsertRowInput
): Promise<Record<string, unknown>> {
  const now = new Date().toISOString();

  // PostgREST upsert will INSERT if the row doesn't exist. To avoid accidental NOT NULL
  // violations, always include required fields (incl. `normalized_event`, `dedupe_hash`).
  return buildFullUpsertRow(input, now);
}

function buildUnchangedUpsertRow(
  input: BuildCandidateUpsertRowInput,
  now: string
): Record<string, unknown> {
  const { runId, event, status, existing, occurrence } = input;

  const detail = resolveCandidateDetailFields(event);

  const row: Record<string, unknown> = {
    source: event.source,
    source_event_id: event.sourceEventId,
    run_id: runId,
    // Keep required columns present even for unchanged rows, so an accidental INSERT
    // cannot violate NOT NULL constraints.
    title: event.title,
    venue_name: event.venueName,
    start_ts: event.startTs,
    normalized_event: event,
    detail_status: detail.detail_status,
    detail_page_url: detail.detail_page_url,
    updated_at: now,
    occurrence_id: occurrence.occurrenceId,
    occurrence_key: occurrence.occurrenceKey,
    url_key: occurrence.urlKey,
    canonical_candidate_id: occurrence.canonicalCandidateId,
    matched_event_id: occurrence.matchedEventId ?? existing?.matched_event_id ?? null
  };

  if (occurrence.statusOverride !== null || (existing !== undefined && existing.status !== status)) {
    row.status = status;
  }

  return row;
}

async function buildFullUpsertRow(
  input: BuildCandidateUpsertRowInput,
  now: string
): Promise<Record<string, unknown>> {
  const { auditKind, runId, event, fingerprint, status, existing, contentChanged, occurrence } = input;

  const detail = resolveCandidateDetailFields(event);

  const row: Record<string, unknown> = {
    run_id: runId,
    source: event.source,
    source_event_id: event.sourceEventId,
    title: event.title,
    venue_name: event.venueName,
    start_ts: event.startTs,
    source_url: event.externalUrl ?? null,
    ticket_url: event.ticketUrl ?? null,
    detail_status: detail.detail_status,
    detail_page_url: detail.detail_page_url,
    normalized_event: event,
    content_fingerprint: fingerprint,
    dedupe_hash: await legacyDedupeHash(event),
    status,
    occurrence_id: occurrence.occurrenceId,
    occurrence_key: occurrence.occurrenceKey,
    url_key: occurrence.urlKey,
    canonical_candidate_id: occurrence.canonicalCandidateId,
    updated_at: now,
    reviewed_at: existing?.reviewed_at ?? null,
    reviewed_by: existing?.reviewed_by ?? null,
    matched_event_id: occurrence.matchedEventId ?? existing?.matched_event_id ?? null,
    review_notes: contentChanged && existing ? null : (existing?.review_notes ?? null)
  };

  // PostgREST bulk upsert requires identical keys on every object (PGRST102).
  row.raw_payload = auditKind === "new" ? {} : (existing?.raw_payload ?? {});
  row.confidence_score =
    auditKind === "new" || shouldResetConfidenceOnChangedUpsert(status)
      ? defaultConfidenceScore(event.source)
      : (existing?.confidence_score ?? defaultConfidenceScore(event.source));

  return row;
}

/** Legacy dedupe_hash (unique constraint); unchanged algorithm for compatibility. */
export async function legacyDedupeHash(event: NormalizedEvent): Promise<string> {
  return sha256Hex(
    legacyDedupeHashInput(event)
  );
}

async function sha256Hex(value: string) {
  const buffer = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return [...new Uint8Array(buffer)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}
