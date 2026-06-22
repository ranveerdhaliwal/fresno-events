import { describe, expect, it } from "vitest";

import { buildReviewQueueAudit } from "@/routes/review-queue-audit.utils";
import type { EventCandidate } from "@fresno-events/shared";

interface AuditRow {
  id: string;
  title: string;
  startTs: string;
  occurrenceId: string | null;
}

interface EventRow {
  id: string;
  slug: string;
  occurrenceId: string | null;
  title: string;
}

function readAuditEnv(): {
  primaries: EventCandidate[];
  scheduledEvents: EventRow[];
} | null {
  const pendingRaw = process.env.AUDIT_PENDING_JSON?.trim();
  const eventsRaw = process.env.AUDIT_EVENTS_JSON?.trim();
  if (!pendingRaw || !eventsRaw) {
    return null;
  }

  const pending = JSON.parse(pendingRaw) as AuditRow[];
  const scheduledEvents = JSON.parse(eventsRaw) as EventRow[];

  return {
    primaries: pending.map((row) => ({
      id: row.id,
      source: "ticketmaster",
      sourceEventId: row.id,
      title: row.title,
      venueName: "Venue",
      startTs: row.startTs,
      normalizedEvent: {
        source: "ticketmaster",
        sourceEventId: row.id,
        title: row.title,
        venueName: "Venue",
        startTs: row.startTs,
        category: "community"
      },
      rawPayload: {},
      dedupeHash: "hash",
      confidenceScore: 0.9,
      status: "pending_review",
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
      detailStatus: "complete",
      occurrenceId: row.occurrenceId ?? crypto.randomUUID()
    })),
    scheduledEvents
  };
}

describe("pending approve slug audit (local db)", () => {
  it("lists slug collisions for pending_review primaries", () => {
    const input = readAuditEnv();
    if (!input) {
      return;
    }

    const audit = buildReviewQueueAudit({
      primaries: input.primaries,
      linkedDuplicates: [],
      scheduledEvents: input.scheduledEvents
    });
    const errors = audit.issues.filter((issue) => issue.severity === "error");

    if (errors.length > 0) {
      console.log("\n=== Pre-approve audit errors ===\n");
      for (const issue of errors) {
        console.log(`${issue.code}\t${issue.candidateId}\t${issue.title.slice(0, 48)}\t${issue.message}`);
      }
      console.log(
        `\nTotal: ${errors.length} error(s), ${audit.summary.warnings} warning(s) across ${audit.summary.pendingPrimaries} pending primaries.\n`
      );
    } else {
      console.log(
        `\nNo blocking issues for ${audit.summary.pendingPrimaries} pending_review primaries (${audit.summary.scheduledEvents} scheduled events, ${audit.summary.warnings} warning(s)).\n`
      );
    }

    expect(errors).toEqual([]);
  });
});
