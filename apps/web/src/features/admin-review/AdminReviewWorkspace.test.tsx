import { beforeEach, describe, expect, it, vi } from "vitest";

import { renderWithProviders, screen } from "@/tests/render";

vi.mock("./ReviewWorkspace", () => ({
  ReviewWorkspace: () => <div data-testid="review-workspace">Review workspace</div>
}));

import { TOKEN_STORAGE_KEY } from "./AdminReviewWorkspace.utils";

import { AdminReviewWorkspace } from "./AdminReviewWorkspace";

describe("AdminReviewWorkspace", () => {
  beforeEach(() => {
    sessionStorage.clear();
  });

  it("renders token gate when no token is stored", () => {
    renderWithProviders(<AdminReviewWorkspace />);

    expect(screen.getByText("Enter the review token")).toBeInTheDocument();
  });

  it("renders review workspace when token is stored", () => {
    sessionStorage.setItem(TOKEN_STORAGE_KEY, "test-token");

    renderWithProviders(<AdminReviewWorkspace />);

    expect(screen.getByTestId("review-workspace")).toBeInTheDocument();
  });
});
