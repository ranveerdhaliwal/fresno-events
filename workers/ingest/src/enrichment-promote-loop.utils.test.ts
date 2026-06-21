import { describe, expect, it } from "vitest";

/** Mirrors runEnrichmentPipeline promote-loop exit (no awaiting_enrichment rows). */
function shouldContinueSufficientPromoteLoop(
  promoted: { updated: number },
  enrichAll: boolean,
  dryRun: boolean
): boolean {
  if (promoted.updated === 0) {
    return false;
  }
  return enrichAll && !dryRun;
}

describe("sufficient promote loop", () => {
  it("stops after one pass when rows are already sufficient (no confidence backfill)", () => {
    expect(shouldContinueSufficientPromoteLoop({ updated: 0 }, true, false)).toBe(false);
  });

  it("continues while confidence backfill updates rows", () => {
    expect(shouldContinueSufficientPromoteLoop({ updated: 22 }, true, false)).toBe(true);
  });

  it("runs a single batch when enrichAll is false", () => {
    expect(shouldContinueSufficientPromoteLoop({ updated: 5 }, false, false)).toBe(false);
  });
});
