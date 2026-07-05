import { beforeEach, describe, expect, it, vi } from "vitest";

import { renderWithProviders, screen } from "@/tests/render";

vi.mock("./PublishedEventsWorkspace", () => ({
  PublishedEventsWorkspace: () => <div data-testid="published-events-workspace">Published events workspace</div>
}));

import { TOKEN_STORAGE_KEY } from "@/features/admin-review/AdminReviewWorkspace.utils";

import { PublishedEventsAdminWorkspace } from "./PublishedEventsAdminWorkspace";

describe("PublishedEventsAdminWorkspace", () => {
  beforeEach(() => {
    sessionStorage.clear();
  });

  it("renders token gate when no token is stored", () => {
    renderWithProviders(<PublishedEventsAdminWorkspace selectedEventId={null} />);

    expect(screen.getByText("Enter the review token")).toBeInTheDocument();
  });

  it("renders published events workspace when token is stored", () => {
    sessionStorage.setItem(TOKEN_STORAGE_KEY, "test-token");

    renderWithProviders(<PublishedEventsAdminWorkspace selectedEventId={null} />);

    expect(screen.getByTestId("published-events-workspace")).toBeInTheDocument();
  });
});
