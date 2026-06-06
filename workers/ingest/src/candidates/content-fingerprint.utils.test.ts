import { describe, expect, it } from "vitest";

import type { NormalizedEvent } from "@fresno-events/shared";

import {
  contentFingerprint,
  fingerprintChanged,
  resolveStatusOnRescrape,
  type ExistingCandidateRow
} from "./content-fingerprint.utils";

const baseEvent: NormalizedEvent = {
  source: "api:milb",
  sourceEventId: "game-1",
  title: "Grizzlies vs Buzzers",
  venueName: "Chukchansi Park",
  startTs: "2026-06-01T02:00:00.000Z",
  category: "sports"
};

const baseNormalized: NormalizedEvent = {
  source: "api:milb",
  sourceEventId: "game-1",
  title: "Grizzlies vs Buzzers",
  venueName: "Chukchansi Park",
  startTs: "2026-06-01T02:00:00.000Z",
  category: "sports"
};

function existingRow(overrides: Partial<ExistingCandidateRow> = {}): ExistingCandidateRow {
  return {
    id: "c1",
    source: "api:milb",
    source_event_id: "game-1",
    status: "approved",
    content_fingerprint: "abc",
    confidence_score: 0.7,
    raw_payload: {},
    matched_event_id: "e1",
    occurrence_id: "occ-1",
    canonical_candidate_id: null,
    reviewed_at: null,
    reviewed_by: null,
    review_notes: null,
    title: baseNormalized.title,
    start_ts: baseNormalized.startTs,
    venue_name: baseNormalized.venueName,
    normalized_event: baseNormalized,
    ...overrides
  };
}

describe("content-fingerprint.utils", () => {
  it("resolveStatusOnRescrape keeps status when fingerprint unchanged", () => {
    const existing = existingRow();
    expect(resolveStatusOnRescrape(existing, "abc")).toBe("approved");
  });

  it("resolveStatusOnRescrape sets needs_changes when approved and content changed", () => {
    const existing = existingRow({ content_fingerprint: "old" });
    expect(resolveStatusOnRescrape(existing, "new")).toBe("needs_changes");
  });

  it("resolveStatusOnRescrape uses awaiting_enrichment for new candidates", () => {
    expect(resolveStatusOnRescrape(undefined, "fp")).toBe("awaiting_enrichment");
  });

  it("resolveStatusOnRescrape keeps awaiting_enrichment when still enriching", () => {
    const existing = existingRow({ status: "awaiting_enrichment", content_fingerprint: "fp" });
    expect(resolveStatusOnRescrape(existing, "fp")).toBe("awaiting_enrichment");
  });

  it("fingerprintChanged detects delta", () => {
    expect(fingerprintChanged(undefined, "x")).toBe(true);
    expect(
      fingerprintChanged(
        existingRow({
          id: "1",
          source_event_id: "a",
          status: "pending_review",
          content_fingerprint: "same",
          matched_event_id: null
        }),
        "same"
      )
    ).toBe(false);
  });

  it("contentFingerprint is stable for same payload", async () => {
    const a = await contentFingerprint(baseEvent);
    const b = await contentFingerprint({ ...baseEvent });
    expect(a).toBe(b);
    const c = await contentFingerprint({ ...baseEvent, title: "Different title" });
    expect(c).not.toBe(a);
  });
});
