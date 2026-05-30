import { describe, expect, it } from "vitest";

import type { OccurrenceMatchIndex } from "@/candidates/occurrence-match.types";
import { pickPrimaryCandidate, resolveOccurrenceForPersist } from "@/candidates/occurrence-resolve.utils";

const emptyIndex: OccurrenceMatchIndex = {
  candidatesByOccurrenceKey: new Map(),
  candidatesByUrlKey: new Map(),
  candidatesByOccurrenceId: new Map(),
  eventsByOccurrenceKey: new Map(),
  eventsByOccurrenceId: new Map()
};

describe("occurrence-resolve.utils", () => {
  it("picks primary by matched_event_id then approved", () => {
    const primary = pickPrimaryCandidate([
      {
        id: "b",
        source: "api:downtownfresno",
        source_event_id: "2",
        status: "pending_review",
        matched_event_id: null,
        occurrence_id: "occ",
        canonical_candidate_id: null,
        created_at: "2026-01-02T00:00:00.000Z",
        occurrence_key: null,
        url_key: null
      },
      {
        id: "a",
        source: "api:visitfresnocounty",
        source_event_id: "1",
        status: "approved",
        matched_event_id: "evt",
        occurrence_id: "occ",
        canonical_candidate_id: null,
        created_at: "2026-01-01T00:00:00.000Z",
        occurrence_key: null,
        url_key: null
      }
    ]);

    expect(primary?.id).toBe("a");
  });

  it("marks new source as duplicate when cross-source dedupe is enabled", async () => {
    const { computeOccurrenceKey } = await import("@fresno-events/shared");
    const event = {
      source: "api:downtownfresno" as const,
      sourceEventId: "d1",
      title: "Jazz Night",
      venueName: "Tower Theatre",
      startTs: "2026-06-01T02:00:00.000Z",
      category: "music" as const
    };
    const occurrenceKey = await computeOccurrenceKey(event.title, event.startTs, event.venueName);
    expect(occurrenceKey).toBeTruthy();

    const index: OccurrenceMatchIndex = {
      ...emptyIndex,
      candidatesByOccurrenceKey: new Map([
        [
          occurrenceKey!,
          [
            {
              id: "primary",
              source: "api:visitfresnocounty",
              source_event_id: "v1",
              status: "pending_review",
              matched_event_id: null,
              occurrence_id: "occ-1",
              canonical_candidate_id: null,
              created_at: "2026-01-01T00:00:00.000Z",
              occurrence_key: occurrenceKey,
              url_key: null
            }
          ]
        ]
      ])
    };

    const result = await resolveOccurrenceForPersist({
      event,
      baseStatus: "awaiting_enrichment",
      crossSourceDedupe: true,
      matchIndex: index
    });

    expect(result.occurrenceId).toBe("occ-1");
    expect(result.statusOverride).toBe("duplicate");
    expect(result.canonicalCandidateId).toBe("primary");
  });
});
