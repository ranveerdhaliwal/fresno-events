import { describe, expect, it } from "vitest";

import type { NormalizedEvent } from "@fresno-events/shared";

import type { ExistingCandidateRow } from "@/candidates/content-fingerprint.utils";
import { contentFingerprint } from "@/candidates/content-fingerprint.utils";
import { analyzeEventsForPersist, mergePersistAuditSummaries } from "@/candidates/persist-analysis.utils";
import { buildPersistAuditSummary } from "@/candidates/persist-audit.utils";

const base: NormalizedEvent = {
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
    title: base.title,
    start_ts: base.startTs,
    venue_name: base.venueName,
    normalized_event: base,
    ...overrides
  };
}

describe("persist-analysis.utils", () => {
  it("analyzeEventsForPersist classifies new, changed, and unchanged rows", async () => {
    const fingerprint = await contentFingerprint(base);
    const existingByKey = new Map<string, ExistingCandidateRow>([
      ["api:milb:game-1", existingRow({ content_fingerprint: fingerprint })],
      [
        "api:milb:game-2",
        existingRow({
          source_event_id: "game-2",
          content_fingerprint: fingerprint,
          normalized_event: { ...base, sourceEventId: "game-2" }
        })
      ]
    ]);

    const events: NormalizedEvent[] = [
      base,
      { ...base, sourceEventId: "game-2" },
      { ...base, sourceEventId: "game-3", title: "Brand new game" }
    ];

    const { summary, analyses } = await analyzeEventsForPersist(events, existingByKey);

    expect(summary).toEqual({
      new: 1,
      changed: 0,
      unchanged: 2,
      new_items: [
        {
          source: "api:milb",
          source_event_id: "game-3",
          title: "Brand new game",
          start_ts: base.startTs,
          venue_name: base.venueName
        }
      ],
      changed_items: []
    });
    expect(analyses.map((row) => row.auditKind)).toEqual(["unchanged", "unchanged", "new"]);
  });

  it("analyzeEventsForPersist detects content changes", async () => {
    const existingByKey = new Map<string, ExistingCandidateRow>([
      ["api:milb:game-1", existingRow({ content_fingerprint: "old" })]
    ]);

    const { summary } = await analyzeEventsForPersist(
      [{ ...base, title: "Updated title" }],
      existingByKey
    );

    expect(summary.new).toBe(0);
    expect(summary.changed).toBe(1);
    expect(summary.changed_items[0]?.changed_fields).toContain("title");
  });

  it("mergePersistAuditSummaries aggregates per-source previews", () => {
    const merged = mergePersistAuditSummaries([
      buildPersistAuditSummary({
        newItems: [{ source: "api:milb", source_event_id: "a", title: "A", start_ts: base.startTs, venue_name: base.venueName }],
        changedItems: [],
        unchangedCount: 2
      }),
      buildPersistAuditSummary({
        newItems: [],
        changedItems: [
          {
            source_event_id: "b",
            title: "B",
            changed_fields: ["title"],
            before: { title: "Old" },
            after: { title: "New" }
          }
        ],
        unchangedCount: 5
      })
    ]);

    expect(merged.new).toBe(1);
    expect(merged.changed).toBe(1);
    expect(merged.unchanged).toBe(7);
    expect(merged.new_items).toHaveLength(1);
    expect(merged.changed_items).toHaveLength(1);
  });
});
