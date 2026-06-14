import { describe, expect, it } from "vitest";

import type { NormalizedEvent } from "@fresno-events/shared";

import {
  buildCandidateUpsertRow,
  defaultConfidenceScore,
  shouldResetConfidenceOnChangedUpsert
} from "@/candidates/candidate-upsert.utils";
import type { ExistingCandidateRow } from "@/candidates/content-fingerprint.utils";
import type { OccurrencePersistFields } from "@/candidates/occurrence-resolve.utils";
import { candidateNeedsEnrichment } from "@/candidates/enrichment-candidate.utils";
import { applyIngestDefaults } from "@/lib/ingest-defaults.utils";

const base: NormalizedEvent = {
  source: "api:visitfresnocounty",
  sourceEventId: "evt-1",
  title: "Summer Concert",
  venueName: "Selland Arena",
  startTs: "2026-06-01T02:00:00.000Z",
  category: "music",
  descriptionText: "Live music outdoors"
};

const baseOccurrence: OccurrencePersistFields = {
  occurrenceId: "occ-1",
  occurrenceKey: "key-1",
  urlKey: "url-1",
  canonicalCandidateId: null,
  matchedEventId: null,
  statusOverride: null,
  matchStep: "new",
  primaryCandidateId: null,
  publishedEventId: null
};

function existingRow(overrides: Partial<ExistingCandidateRow> = {}): ExistingCandidateRow {
  return {
    id: "c1",
    source: "api:visitfresnocounty",
    source_event_id: "evt-1",
    status: "pending_review",
    content_fingerprint: "fp-1",
    confidence_score: 0.98,
    raw_payload: {},
    matched_event_id: null,
    occurrence_id: "occ-1",
    canonical_candidate_id: null,
    reviewed_at: null,
    reviewed_by: null,
    review_notes: "[ai] enriched",
    title: base.title,
    start_ts: base.startTs,
    venue_name: base.venueName,
    normalized_event: { ...base, tags: ["live"] },
    ...overrides
  };
}

describe("candidate-upsert.utils", () => {
  it("unchanged upsert only touches run metadata and occurrence fields", async () => {
    const row = await buildCandidateUpsertRow({
      auditKind: "unchanged",
      runId: "run-2",
      event: base,
      fingerprint: "fp-1",
      status: "pending_review",
      existing: existingRow(),
      contentChanged: false,
      occurrence: baseOccurrence
    });

    expect(row).toMatchObject({
      source: base.source,
      source_event_id: base.sourceEventId,
      run_id: "run-2",
      occurrence_id: "occ-1",
      detail_status: "complete",
      detail_page_url: null
    });
    expect(row.updated_at).toEqual(expect.any(String));
    expect(row.detail_status).toBe("complete");
  });

  it("unchanged upsert includes status when occurrence overrides to duplicate", async () => {
    const row = await buildCandidateUpsertRow({
      auditKind: "unchanged",
      runId: "run-2",
      event: base,
      fingerprint: "fp-1",
      status: "duplicate",
      existing: existingRow({ status: "pending_review" }),
      contentChanged: false,
      occurrence: {
        ...baseOccurrence,
        statusOverride: "duplicate",
        canonicalCandidateId: "primary-1"
      }
    });

    expect(row.status).toBe("duplicate");
    expect(row.canonical_candidate_id).toBe("primary-1");
  });

  it("new upsert includes default confidence and raw_payload", async () => {
    const row = await buildCandidateUpsertRow({
      auditKind: "new",
      runId: "run-1",
      event: base,
      fingerprint: "fp-new",
      status: "awaiting_enrichment",
      contentChanged: true,
      occurrence: baseOccurrence
    });

    expect(row.confidence_score).toBe(0.7);
    expect(row.raw_payload).toEqual({});
    expect(row.normalized_event).toEqual(applyIngestDefaults(base));
    expect(row.review_notes).toBeNull();
  });

  it("new ticketmaster upsert uses 0.84 confidence", async () => {
    const row = await buildCandidateUpsertRow({
      auditKind: "new",
      runId: "run-1",
      event: { ...base, source: "ticketmaster" },
      fingerprint: "fp-new",
      status: "awaiting_enrichment",
      contentChanged: true,
      occurrence: baseOccurrence
    });

    expect(row.confidence_score).toBe(0.84);
  });

  it("changed needs_changes upsert clears notes and omits confidence", async () => {
    const row = await buildCandidateUpsertRow({
      auditKind: "changed",
      runId: "run-2",
      event: { ...base, title: "Updated title" },
      fingerprint: "fp-2",
      status: "needs_changes",
      existing: existingRow({ status: "approved", matched_event_id: "e1" }),
      contentChanged: true,
      occurrence: { ...baseOccurrence, matchedEventId: "e1" }
    });

    expect(row.review_notes).toBeNull();
    expect(row.normalized_event).toMatchObject({ title: "Updated title" });
    expect(row.confidence_score).toBe(0.98);
    expect(row.raw_payload).toEqual({});
  });

  it("new and changed rows in one batch share the same keys", async () => {
    const newRow = await buildCandidateUpsertRow({
      auditKind: "new",
      runId: "run-1",
      event: base,
      fingerprint: "fp-new",
      status: "awaiting_enrichment",
      contentChanged: true,
      occurrence: baseOccurrence
    });
    const changedRow = await buildCandidateUpsertRow({
      auditKind: "changed",
      runId: "run-1",
      event: { ...base, title: "Updated title" },
      fingerprint: "fp-2",
      status: "needs_changes",
      existing: existingRow({ status: "approved", matched_event_id: "e1" }),
      contentChanged: true,
      occurrence: { ...baseOccurrence, matchedEventId: "e1" }
    });

    expect(Object.keys(newRow).sort()).toEqual(Object.keys(changedRow).sort());
  });

  it("changed pending_review upsert resets default confidence", async () => {
    const row = await buildCandidateUpsertRow({
      auditKind: "changed",
      runId: "run-2",
      event: { ...base, title: "Updated title" },
      fingerprint: "fp-2",
      status: "pending_review",
      existing: existingRow(),
      contentChanged: true,
      occurrence: baseOccurrence
    });

    expect(row.review_notes).toBeNull();
    expect(row.confidence_score).toBe(defaultConfidenceScore(base.source));
  });

  it("shouldResetConfidenceOnChangedUpsert is true only for pending_review", () => {
    expect(shouldResetConfidenceOnChangedUpsert("pending_review")).toBe(true);
    expect(shouldResetConfidenceOnChangedUpsert("needs_changes")).toBe(false);
    expect(shouldResetConfidenceOnChangedUpsert("awaiting_enrichment")).toBe(false);
  });

  it("needs_changes needs enrichment after content change clears ai notes", () => {
    // On a content re-scrape, buildFullUpsertRow clears review_notes (contentChanged && existing),
    // so the needs_changes row re-enters enrichment for one fresh pass.
    expect(
      candidateNeedsEnrichment({
        id: "c1",
        status: "needs_changes",
        normalized_event: base,
        confidence_score: 0.98,
        review_notes: null,
        suggested_priority: 2,
        matched_event_id: "e1"
      })
    ).toBe(true);
  });
});
