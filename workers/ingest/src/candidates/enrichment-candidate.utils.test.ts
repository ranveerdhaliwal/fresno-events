import { describe, expect, it } from "vitest";

import type { NormalizedEvent } from "@fresno-events/shared";

import {
  candidateNeedsEnrichment,
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

  it("candidateNeedsEnrichment skips already enriched or sufficient rows", () => {
    expect(
      candidateNeedsEnrichment({
        id: "1",
        normalized_event: base,
        confidence_score: 0.7,
        review_notes: "[ai] done",
        suggested_priority: 5
      })
    ).toBe(false);

    expect(
      candidateNeedsEnrichment({
        id: "2",
        normalized_event: { ...base, descriptionText: "Full write-up" },
        confidence_score: 0.7,
        review_notes: null,
        suggested_priority: null
      })
    ).toBe(false);

    expect(
      candidateNeedsEnrichment({
        id: "3",
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
});
