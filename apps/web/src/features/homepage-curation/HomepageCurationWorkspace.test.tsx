import { beforeEach, describe, expect, it, vi } from "vitest";

import { renderWithProviders, screen } from "@/tests/render";

const homepageSlotsData = {
  slots: [
    {
      section: "featured" as const,
      position: 1,
      eventId: null,
      event: null,
      stale: false
    }
  ]
};

const mockQueryState = vi.hoisted(() => ({
  isLoading: false
}));

vi.mock("@tanstack/react-query", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@tanstack/react-query")>();
  return {
    ...actual,
    useQuery: () => ({
      data: mockQueryState.isLoading ? undefined : homepageSlotsData,
      isLoading: mockQueryState.isLoading,
      error: null
    }),
    useMutation: () => ({
      mutate: vi.fn(),
      isPending: false,
      error: null
    })
  };
});

import { HomepageCurationWorkspace } from "./HomepageCurationWorkspace";

describe("HomepageCurationWorkspace", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders skeleton while slots load", () => {
    mockQueryState.isLoading = true;
    renderWithProviders(
      <HomepageCurationWorkspace token="test-token" onAuthFailure={vi.fn()} />
    );

    expect(screen.getByTestId("homepage-curation-skeleton")).toBeInTheDocument();
    mockQueryState.isLoading = false;
  });

  it("renders homepage curation workspace", () => {
    renderWithProviders(
      <HomepageCurationWorkspace token="test-token" onAuthFailure={vi.fn()} />
    );

    expect(screen.getByText("Pin featured slots")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Save slots" })).toBeInTheDocument();
  });
});
