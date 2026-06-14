import { describe, expect, it } from "vitest";

import {
  buildOccurrenceRelinkOpsResponse,
  buildVenueAddressBackfillOpsResponse
} from "@/routes/review-ops-message.utils";

describe("review-ops-message.utils", () => {
  it("maps relink summary for dry run", () => {
    const response = buildOccurrenceRelinkOpsResponse(true, {
      changed: 12,
      link_groups_changed: 8,
      multi_source_groups: 3,
      link_examples: [
        {
          title: "Miss California 2026",
          primary_source: "ticketmaster",
          linked_sources: ["visitfresnocounty", "events.fresnoconventioncenter.com"],
          cross_source: true,
          would_change: true
        }
      ]
    });

    expect(response.summary.changed).toBe(12);
    expect(response.summary.linkGroupsChanged).toBe(8);
    expect(response.dryRun).toBe(true);
    expect(response.message).toContain("Would update 12 row(s)");
    expect(response.message).toContain("8 link group(s)");
    expect(response.message).toContain("Miss California 2026");
    expect(response.message).toContain("Click Run to apply.");
  });

  it("defaults missing link example fields", () => {
    const response = buildOccurrenceRelinkOpsResponse(true, {
      changed: 2,
      link_groups_changed: 1
    });

    expect(response.summary.linkExamples).toEqual([]);
    expect(response.summary.linkGroupsChanged).toBe(1);
    expect(response.message).toContain("Would update 2 row(s)");
  });

  it("maps address backfill summary", () => {
    const response = buildVenueAddressBackfillOpsResponse(true, {
      scanned: 280,
      candidate_updates: 5,
      venue_updates: 2
    });

    expect(response.summary.candidateUpdates).toBe(5);
    expect(response.message).toContain("5 candidate address(es) to fix");
  });
});
