import { beforeEach, describe, expect, it } from "vitest";

import { renderWithProviders, screen } from "@/tests/render";

import { AdminMaintenancePanel, type MaintenanceOpResult } from "./AdminMaintenancePanel";

function relinkResult(overrides: Partial<MaintenanceOpResult> = {}): MaintenanceOpResult {
  return {
    kind: "relink",
    dryRun: true,
    relink: {
      dryRun: true,
      message: "Would update 12 row(s) across 8 link group(s).",
      summary: {
        candidates: 1090,
        relinkable: 1000,
        skippedRejected: 0,
        groups: 500,
        multiSourceGroups: 38,
        changed: 12,
        unchanged: 0,
        applied: 0,
        errors: 0,
        linkedAsDuplicate: 0,
        promotedFromDuplicate: 0,
        demotedToDuplicate: 0,
        occurrenceKeyChanged: 0,
        occurrenceIdChanged: 0,
        priorityInherited: 0,
        linkGroups: 52,
        linkGroupsChanged: 8
      } as never
    },
    ...overrides
  };
}

describe("AdminMaintenancePanel", () => {
  beforeEach(() => {
    sessionStorage.setItem("wuf:admin_maintenance_collapsed", "0");
  });

  it("renders relink preview when linkExamples is missing", () => {
    renderWithProviders(
      <AdminMaintenancePanel
        activeOp={null}
        isLoading={false}
        result={relinkResult()}
        onCheck={() => undefined}
        onApply={() => undefined}
        onDismiss={() => undefined}
      />
    );

    expect(screen.getByText("12")).toBeInTheDocument();
    expect(screen.getByText("Rows to update")).toBeInTheDocument();
    expect(screen.getByText("8")).toBeInTheDocument();
    expect(screen.getByText("Link groups")).toBeInTheDocument();
    expect(screen.getByText(/Would update 12 row\(s\)/)).toBeInTheDocument();
  });

  it("renders relink link examples when present", () => {
    renderWithProviders(
      <AdminMaintenancePanel
        activeOp={null}
        isLoading={false}
        result={relinkResult({
          relink: {
            dryRun: true,
            message: "Would update 1 row(s).",
            summary: {
              changed: 1,
              linkGroupsChanged: 1,
              linkExamples: [
                {
                  title: "Miss California 2026",
                  primarySource: "ticketmaster",
                  linkedSources: ["visitfresnocounty"],
                  crossSource: true,
                  wouldChange: true
                }
              ]
            } as never
          }
        })}
        onCheck={() => undefined}
        onApply={() => undefined}
        onDismiss={() => undefined}
      />
    );

    expect(screen.getByText(/Miss California 2026/)).toBeInTheDocument();
    expect(screen.getByText(/visitfresnocounty · cross-source/)).toBeInTheDocument();
  });

  it("renders orphan cleanup preview with deletion samples", () => {
    renderWithProviders(
      <AdminMaintenancePanel
        activeOp={null}
        isLoading={false}
        result={{
          kind: "orphans",
          dryRun: true,
          orphans: {
            dryRun: true,
            message: "Would delete 2 orphan published event(s) across 2 duplicate group(s).",
            summary: {
              scheduledScanned: 100,
              duplicateGroups: 2,
              wouldDelete: 2,
              deleted: 0,
              errors: 0,
              deletions: [
                {
                  eventId: "orphan-1",
                  slug: "friday-night-wine-down-96ebe5b2",
                  title: "Friday Night Wine Down",
                  keepEventId: "keep-1",
                  keepSlug: "friday-night-wine-down-2026-06-19-1800"
                }
              ]
            }
          }
        }}
        onCheck={() => undefined}
        onApply={() => undefined}
        onDismiss={() => undefined}
      />
    );

    expect(screen.getByText("Would delete")).toBeInTheDocument();
    expect(screen.getByText(/Friday Night Wine Down/)).toBeInTheDocument();
    expect(screen.getByText(/friday-night-wine-down-96ebe5b2/)).toBeInTheDocument();
    expect(screen.getByText(/Would delete 2 orphan published event/)).toBeInTheDocument();
  });
});
