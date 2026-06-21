import { describe, expect, it } from "vitest";

import type { NormalizedEvent } from "@fresno-events/shared";

import type { ExistingCandidateRow } from "@/candidates/content-fingerprint.utils";
import { contentFingerprint } from "@/candidates/content-fingerprint.utils";
import { analyzeEventsForPersist, mergePersistAuditSummaries } from "@/candidates/persist-analysis.utils";
import { buildPersistAuditSummary } from "@/candidates/persist-audit.utils";
import { applyIngestDefaults } from "@/lib/ingest-defaults.utils";

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
    const fingerprint = await contentFingerprint(applyIngestDefaults(base));
    const defaults = applyIngestDefaults(base);
    const existingByKey = new Map<string, ExistingCandidateRow>([
      ["api:milb:game-1", existingRow({ content_fingerprint: fingerprint, normalized_event: defaults })],
      [
        "api:milb:game-2",
        existingRow({
          source_event_id: "game-2",
          content_fingerprint: fingerprint,
          normalized_event: { ...defaults, sourceEventId: "game-2" }
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

  it("analyzeEventsForPersist classifies fair imageUrl backfill as changed", async () => {
    const fairBase: NormalizedEvent = {
      source: "scrape:www.fresnofair.com",
      sourceEventId: "venue:big-fresno-fair:3714:2026-10-07",
      title: "Kansas With Starship feat. Mickey Thomas",
      venueName: "Big Fresno Fair",
      startTs: "2026-10-08T02:00:00.000Z",
      category: "festival"
    };
    const fingerprint = await contentFingerprint(applyIngestDefaults(fairBase));
    const existingByKey = new Map<string, ExistingCandidateRow>([
      [
        "scrape:www.fresnofair.com:venue:big-fresno-fair:3714:2026-10-07",
        existingRow({
          source: "scrape:www.fresnofair.com",
          source_event_id: "venue:big-fresno-fair:3714:2026-10-07",
          content_fingerprint: fingerprint,
          normalized_event: fairBase
        })
      ]
    ]);

    const { summary, analyses } = await analyzeEventsForPersist(
      [
        {
          ...fairBase,
          imageUrl: "https://cdn.saffire.com/images.ashx?i=Kansas_OnScreen.jpg"
        }
      ],
      existingByKey
    );

    expect(summary.changed).toBe(1);
    expect(summary.unchanged).toBe(0);
    expect(analyses[0]?.auditKind).toBe("changed");
  });

  it("analyzeEventsForPersist omits endTs when the source did not supply one", async () => {
    const incoming: NormalizedEvent = {
      ...base,
      venueName: "Tower Theatre for the Performing Arts"
    };
    const { analyses } = await analyzeEventsForPersist([incoming], new Map());
    expect(analyses[0]?.event.endTs).toBeUndefined();
  });

  it("analyzeEventsForPersist flags removal of a legacy fabricated endTs", async () => {
    const incoming: NormalizedEvent = {
      ...base,
      venueName: "Tower Theatre for the Performing Arts"
    };
    const stored = {
      ...applyIngestDefaults(incoming),
      endTs: "2026-06-01T04:00:00.000Z"
    };
    const fingerprint = await contentFingerprint(stored);
    const existingByKey = new Map<string, ExistingCandidateRow>([
      [
        "api:milb:game-1",
        existingRow({
          content_fingerprint: fingerprint,
          normalized_event: stored,
          venue_name: "Tower Theatre for the Performing Arts"
        })
      ]
    ]);

    const { summary } = await analyzeEventsForPersist([incoming], existingByKey);

    expect(summary.changed).toBe(1);
    expect(summary.unchanged).toBe(0);
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
