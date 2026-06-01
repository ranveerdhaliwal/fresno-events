import { describe, expect, it } from "vitest";

import type { NormalizedEvent } from "@fresno-events/shared";

import {
  candidateNeedsEnrichment,
  formatEnrichmentDoneLine,
  hasAiEnrichmentNotes,
  hasSufficientReviewData,
  summarizeEnrichmentDelta
} from "./enrichment-candidate.utils";

const base: NormalizedEvent = {
  source: "api:visitfresnocounty",
  sourceEventId: "x",
  title: "Concert",
  venueName: "Venue",
  startTs: "2026-06-01T02:00:00.000Z",
  category: "music"
};

describe("enrichment-candidate.utils", () => {
  it("detects ai review notes", () => {
    expect(hasAiEnrichmentNotes("[ai] looks good")).toBe(true);
    expect(hasAiEnrichmentNotes(null)).toBe(false);
  });

  it("hasSufficientReviewData when description present", () => {
    expect(hasSufficientReviewData({ ...base, descriptionText: "Details here" })).toBe(true);
    expect(hasSufficientReviewData(base)).toBe(false);
  });

  it("candidateNeedsEnrichment always runs for needs_changes", () => {
    expect(
      candidateNeedsEnrichment({
        id: "4",
        status: "needs_changes",
        normalized_event: { ...base, descriptionText: "Full write-up" },
        confidence_score: 0.9,
        review_notes: "[ai] done",
        suggested_priority: 2,
        matched_event_id: "e1"
      })
    ).toBe(true);
  });

  it("candidateNeedsEnrichment skips already enriched or sufficient rows", () => {
    expect(
      candidateNeedsEnrichment({
        id: "1",
        status: "pending_review",
        normalized_event: base,
        confidence_score: 0.7,
        review_notes: "[ai] done",
        suggested_priority: 5
      })
    ).toBe(false);

    expect(
      candidateNeedsEnrichment({
        id: "2",
        status: "pending_review",
        normalized_event: { ...base, descriptionText: "Full write-up" },
        confidence_score: 0.7,
        review_notes: null,
        suggested_priority: null
      })
    ).toBe(false);

    expect(
      candidateNeedsEnrichment({
        id: "3",
        status: "pending_review",
        normalized_event: base,
        confidence_score: 0.7,
        review_notes: null,
        suggested_priority: null
      })
    ).toBe(true);
  });

  it("summarizeEnrichmentDelta reports title and category changes", () => {
    const delta = summarizeEnrichmentDelta(
      base,
      {
        confidence: 0.9,
        category: "festival",
        cleaned_title: "Cleaned Concert",
        tags: ["live"],
        is_junk: false,
        reasoning: "Major downtown draw.",
        suggested_priority: 2
      },
      { autoReject: false }
    );

    expect(delta.title_changed).toBe(true);
    expect(delta.title_after).toBe("Cleaned Concert");
    expect(delta.category_changed).toBe(true);
    expect(delta.tags_added).toContain("live");
    expect(delta.db_fields).toContain("normalized_event");
    expect(delta.db_fields).toContain("title");
    expect(delta.status_change).toBeNull();
  });

  it("summarizeEnrichmentDelta reports junk rejection", () => {
    const delta = summarizeEnrichmentDelta(
      base,
      {
        confidence: 0.1,
        category: null,
        cleaned_title: null,
        tags: [],
        is_junk: true,
        reasoning: "Parking pass ad.",
        suggested_priority: 0
      },
      { autoReject: true }
    );

    expect(delta.status_change).toBe("pending_review → rejected");
    expect(delta.db_fields).toContain("status");
  });

  it("formatEnrichmentDoneLine fits on one readable line", () => {
    const delta = summarizeEnrichmentDelta(
      base,
      {
        confidence: 0.98,
        category: "sports",
        cleaned_title: null,
        tags: ["baseball", "grizzlies"],
        is_junk: false,
        reasoning: "Local baseball game.",
        suggested_priority: 4
      },
      { autoReject: false }
    );

    const line = formatEnrichmentDoneLine(
      base.title,
      delta,
      {
        confidence: 0.98,
        category: "sports",
        cleaned_title: null,
        tags: ["baseball", "grizzlies"],
        is_junk: false,
        reasoning: "Local baseball game.",
        suggested_priority: 4
      },
      { index: 2, total: 100 }
    );

    expect(line).toMatch(/^\[ingest\] enriched 2\/100:/);
    expect(line).toContain("conf 0.98");
    expect(line).toContain("category music → sports");
    expect(line).toContain("tags +2");
  });
});
