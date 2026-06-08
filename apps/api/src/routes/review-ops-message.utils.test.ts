import { describe, expect, it } from "vitest";

import {
  buildOccurrenceRelinkOpsResponse,
  buildVenueAddressBackfillOpsResponse
} from "@/routes/review-ops-message.utils";

describe("review-ops-message.utils", () => {
  it("maps relink summary for dry run", () => {
    const response = buildOccurrenceRelinkOpsResponse(true, {
      candidates: 100,
      relinkable: 95,
      changed: 12,
      unchanged: 83,
      multi_source_groups: 8
    });

    expect(response.summary.changed).toBe(12);
    expect(response.dryRun).toBe(true);
    expect(response.message).toContain("Check only");
    expect(response.message).toContain("12 row(s) would update");
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
