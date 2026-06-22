import { describe, expect, it } from "vitest";

import type { EventCandidate } from "@fresno-events/shared";

import { buildReviewQueueAudit } from "@/routes/review-queue-audit.utils";

function primary(
  patch: Partial<EventCandidate> & Pick<EventCandidate, "id" | "title" | "startTs">
): EventCandidate {
  return {
    source: "ticketmaster",
    sourceEventId: patch.id,
    venueName: "Save Mart Center",
    normalizedEvent: {
      source: "ticketmaster",
      sourceEventId: patch.id,
      title: patch.title,
      venueName: "Save Mart Center",
      startTs: patch.startTs,
      category: "community"
    },
    rawPayload: {},
    dedupeHash: "hash",
    confidenceScore: 0.9,
    status: "pending_review",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    detailStatus: "complete",
    occurrenceId: patch.occurrenceId ?? crypto.randomUUID(),
    ...patch
  };
}

describe("buildReviewQueueAudit", () => {
  it("skips slug check when occurrence already has a scheduled event", () => {
    const occurrenceId = "occ-1";
    const audit = buildReviewQueueAudit({
      primaries: [
        primary({
          id: "c1",
          title: "Ringling Bros.",
          startTs: "2026-07-06T00:00:00.000Z",
          occurrenceId,
          reviewNotes: "[ai] ok"
        })
      ],
      linkedDuplicates: [],
      scheduledEvents: [
        {
          id: "e1",
          slug: "ringling-bros-and-barnum-bailey-presents-the-greatest-show-on-earth-2026-07-05",
          occurrenceId,
          title: "Ringling Bros."
        }
      ]
    });

    expect(audit.summary.errors).toBe(0);
    expect(audit.issues).toHaveLength(0);
  });

  it("flags pending linked duplicates and ticketmaster without ai notes", () => {
    const audit = buildReviewQueueAudit({
      primaries: [
        primary({
          id: "tm-1",
          title: "Headliner",
          startTs: "2026-08-01T02:00:00.000Z"
        })
      ],
      linkedDuplicates: [{ id: "dup-1", title: "Duplicate row", canonicalCandidateId: "primary-1" }],
      scheduledEvents: []
    });

    expect(audit.issues.some((issue) => issue.code === "pending_linked_duplicate")).toBe(true);
    expect(audit.issues.some((issue) => issue.code === "ticketmaster_needs_ai")).toBe(true);
  });
});
