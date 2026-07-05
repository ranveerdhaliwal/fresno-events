import { describe, expect, it, vi } from "vitest";

import { renderWithProviders, screen } from "@/tests/render";

import { ReviewQueueAuditPanel } from "./ReviewQueueAuditPanel";

describe("ReviewQueueAuditPanel", () => {
  it("renders audit summary when audit data is present", () => {
    renderWithProviders(
      <ReviewQueueAuditPanel
        audit={{
          generatedAt: "2026-07-05T12:00:00.000Z",
          summary: {
            pendingPrimaries: 5,
            scheduledEvents: 12,
            errors: 0,
            warnings: 1
          },
          issues: []
        }}
        isLoading={false}
        error={null}
        onDismiss={vi.fn()}
      />
    );

    expect(screen.getByText("Pre-approve check")).toBeInTheDocument();
    expect(screen.getByText(/ready to approve/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Dismiss" })).toBeInTheDocument();
  });
});
