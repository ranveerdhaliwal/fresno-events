import { describe, expect, it, vi } from "vitest";

import { renderWithProviders, screen } from "@/tests/render";

import { CandidateDetailDecisionActions } from "./CandidateDetailDecisionActions";

describe("CandidateDetailDecisionActions", () => {
  it("renders approve and reject actions", () => {
    renderWithProviders(
      <CandidateDetailDecisionActions
        isBusy={false}
        hasEdits={false}
        onReject={vi.fn()}
        onApprove={vi.fn()}
      />
    );

    expect(screen.getByRole("button", { name: "Reject" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Approve" })).toBeInTheDocument();
  });
});
