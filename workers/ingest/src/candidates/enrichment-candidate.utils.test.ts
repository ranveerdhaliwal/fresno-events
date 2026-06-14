import { describe, expect, it } from "vitest";

import type { NormalizedEvent } from "@fresno-events/shared";

import {
  candidateNeedsEnrichment,
  formatEnrichmentDoneLine,
  hasAiEnrichmentNotes,
  hasSufficientReviewData,
  isBlockedByPendingDetail,
  needsSufficientConfidenceBackfill,
  SUFFICIENT_WITHOUT_LLM_CONFIDENCE,
  summarizeEnrichmentDelta,
  ticketmasterRequiresAiEnrichment
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

  it("isBlockedByPendingDetail only blocks Visit Fresno without price", () => {
    const milbRow = {
      id: "milb-1",
      status: "awaiting_enrichment" as const,
      normalized_event: {
        source: "api:milb" as const,
        sourceEventId: "milb:1",
        title: "Grizzlies game",
        venueName: "Chukchansi Park",
        startTs: "2026-06-15T02:00:00.000Z",
        category: "sports" as const
      },
      confidence_score: 0.5,
      review_notes: null,
      suggested_priority: null,
      detail_status: "pending"
    };
    expect(isBlockedByPendingDetail(milbRow)).toBe(false);

    expect(
      isBlockedByPendingDetail({
        ...milbRow,
        normalized_event: {
          source: "api:visitfresnocounty",
          sourceEventId: "vf-1",
          title: "Festival",
          venueName: "Plaza",
          startTs: "2026-06-15T02:00:00.000Z",
          category: "festival",
          externalUrl: "https://www.visitfresnocounty.org/event/foo/1/"
        }
      })
    ).toBe(true);
  });

  it("candidateNeedsEnrichment runs for needs_changes until AI notes are written", () => {
    expect(
      candidateNeedsEnrichment({
        id: "4",
        status: "needs_changes",
        normalized_event: { ...base, descriptionText: "Full write-up" },
        confidence_score: 0.9,
        review_notes: null,
        suggested_priority: 2,
        matched_event_id: "e1"
      })
    ).toBe(true);
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
    ).toBe(false);
  });

  it("ticketmasterRequiresAiEnrichment even when payload is otherwise sufficient", () => {
    const tmRow = {
      id: "tm-1",
      status: "pending_review" as const,
      normalized_event: {
        ...base,
        source: "ticketmaster" as const,
        descriptionText: "Full Ticketmaster write-up."
      },
      confidence_score: 0.95,
      review_notes: null,
      suggested_priority: 5
    };

    expect(ticketmasterRequiresAiEnrichment(tmRow)).toBe(true);
    expect(candidateNeedsEnrichment(tmRow)).toBe(true);

    expect(
      candidateNeedsEnrichment({
        ...tmRow,
        review_notes: "[ai] headliner comedy tour"
      })
    ).toBe(false);
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

  it("needsSufficientConfidenceBackfill bumps placeholder confidence for new and re-scraped rows", () => {
    const awaiting = {
      id: "1",
      status: "awaiting_enrichment" as const,
      normalized_event: base,
      confidence_score: 0.7,
      review_notes: null,
      suggested_priority: null
    };

    // New row still at the placeholder default → backfill.
    expect(needsSufficientConfidenceBackfill(awaiting)).toBe(true);

    // pending_review row reset to placeholder on a content re-scrape → backfill (the bug fix).
    expect(
      needsSufficientConfidenceBackfill({
        ...awaiting,
        status: "pending_review",
        review_notes: null
      })
    ).toBe(true);

    // Already carries the sufficient score → leave it (no per-run churn).
    expect(
      needsSufficientConfidenceBackfill({
        ...awaiting,
        confidence_score: SUFFICIENT_WITHOUT_LLM_CONFIDENCE,
        review_notes: "[ingest] skipped LLM"
      })
    ).toBe(false);

    // Already LLM-enriched → never overwrite.
    expect(
      needsSufficientConfidenceBackfill({
        ...awaiting,
        confidence_score: 0.7,
        review_notes: "[ai] done"
      })
    ).toBe(false);
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

  it("fair promote regression: enriched needs_changes rows do not re-queue LLM", () => {
    const enrichedNeedsChanges = {
      id: "fair-40",
      status: "needs_changes" as const,
      normalized_event: {
        source: "scrape:www.fresnofair.com" as const,
        sourceEventId: "venue:big-fresno-fair:58:2026-10-07",
        title: "4.0 & Above Program",
        venueName: "Big Fresno Fair",
        startTs: "2026-10-07T18:30:00.000Z",
        category: "education" as const,
        descriptionText: "Student achievement program at the fair."
      },
      confidence_score: 1,
      review_notes: "[ai] Official event at Big Fresno Fair celebrating student achievements.",
      suggested_priority: 4,
      matched_event_id: "published-1"
    };

    const queue = [
      enrichedNeedsChanges,
      {
        id: "fair-new",
        status: "awaiting_enrichment" as const,
        normalized_event: {
          source: "scrape:www.fresnofair.com" as const,
          sourceEventId: "venue:big-fresno-fair:9999:2026-10-20",
          title: "Brand New Fair Row",
          venueName: "Big Fresno Fair",
          startTs: "2026-10-20T18:30:00.000Z",
          category: "festival" as const
        },
        confidence_score: 0.7,
        review_notes: null,
        suggested_priority: null
      }
    ];

    expect(queue.filter(candidateNeedsEnrichment)).toEqual([queue[1]]);
    expect(candidateNeedsEnrichment(enrichedNeedsChanges)).toBe(false);
  });

  it("needs_changes re-queues LLM after promote clears review_notes on content change", () => {
    expect(
      candidateNeedsEnrichment({
        id: "fair-40",
        status: "needs_changes",
        normalized_event: {
          ...base,
          source: "scrape:www.fresnofair.com",
          descriptionText: "Updated fair copy after image backfill."
        },
        confidence_score: 0.9,
        review_notes: null,
        suggested_priority: 4,
        matched_event_id: "published-1"
      })
    ).toBe(true);
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
