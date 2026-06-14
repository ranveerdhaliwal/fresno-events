import { describe, expect, it } from "vitest";

import {
  normalizeOccurrenceRelinkOpsResponse,
  normalizeOccurrenceRelinkSummary,
  normalizePriorityRuleGroups
} from "./admin-maintenance.utils";

describe("admin-maintenance.utils", () => {
  it("fills missing relink summary fields", () => {
    const summary = normalizeOccurrenceRelinkSummary({
      changed: 12,
      linkGroupsChanged: 8
    });

    expect(summary.changed).toBe(12);
    expect(summary.linkGroupsChanged).toBe(8);
    expect(summary.linkGroups).toBe(0);
    expect(summary.linkExamples).toEqual([]);
  });

  it("drops relink examples without linked sources", () => {
    const summary = normalizeOccurrenceRelinkSummary({
      linkExamples: [
        {
          title: "Miss California 2026",
          primarySource: "ticketmaster",
          linkedSources: ["visitfresnocounty"],
          crossSource: true,
          wouldChange: true
        },
        {
          title: "Broken row",
          primarySource: "ticketmaster",
          linkedSources: [],
          crossSource: false,
          wouldChange: false
        }
      ]
    });

    expect(summary.linkExamples).toHaveLength(1);
    expect(summary.linkExamples[0]?.title).toBe("Miss California 2026");
  });

  it("normalizes relink ops response", () => {
    const response = normalizeOccurrenceRelinkOpsResponse({
      dryRun: true,
      message: "Would update 2 row(s).",
      summary: {
        candidates: 0,
        relinkable: 0,
        skippedRejected: 0,
        groups: 0,
        multiSourceGroups: 0,
        changed: 2,
        unchanged: 0,
        applied: 0,
        errors: 0,
        linkedAsDuplicate: 0,
        promotedFromDuplicate: 0,
        demotedToDuplicate: 0,
        occurrenceKeyChanged: 0,
        occurrenceIdChanged: 0,
        priorityInherited: 0,
        linkGroups: 1,
        linkGroupsChanged: 1
      } as never
    });

    expect(response.summary.linkExamples).toEqual([]);
  });

  it("normalizes missing priority rule groups", () => {
    expect(normalizePriorityRuleGroups(undefined)).toEqual([]);
  });
});
