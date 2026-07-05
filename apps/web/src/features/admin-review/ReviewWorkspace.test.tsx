import { beforeEach, describe, expect, it, vi } from "vitest";

import { renderWithProviders, screen } from "@/tests/render";

vi.mock("@tanstack/react-query", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@tanstack/react-query")>();
  return {
    ...actual,
    useQuery: (options: { queryKey?: unknown[] }) => {
      const key = options.queryKey?.[0];
      if (key === "admin") {
        const subKey = options.queryKey?.[1];
        if (subKey === "candidate-counts") {
          return { data: { new: 0, updates: 0, approved: 0, rejected: 0 }, isLoading: false, error: null };
        }
        if (subKey === "candidates") {
          return { data: { items: [], total: 0 }, isLoading: false, isFetching: false, error: null, refetch: vi.fn() };
        }
        if (subKey === "candidate") {
          return { data: null, isLoading: false, error: null };
        }
      }
      return { data: { items: [], total: 0 }, isLoading: false, isFetching: false, error: null, refetch: vi.fn() };
    },
    useMutation: () => ({
      mutate: vi.fn(),
      isPending: false
    })
  };
});

vi.mock("../admin/admin-priority.utils", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../admin/admin-priority.utils")>();
  return {
    ...actual,
    readPriorityOverrides: () => ({})
  };
});

import { ReviewWorkspace } from "./ReviewWorkspace";

describe("ReviewWorkspace", () => {
  beforeEach(() => {
    sessionStorage.setItem("wuf:admin_maintenance_collapsed", "1");
    vi.clearAllMocks();
  });

  it("renders review queue workspace", () => {
    renderWithProviders(
      <ReviewWorkspace
        token="test-token"
        activeTab="new"
        onActiveTabChange={vi.fn()}
        selectedId={null}
        onSelect={vi.fn()}
        onChangeToken={vi.fn()}
        onAuthFailure={vi.fn()}
      />
    );

    expect(screen.getByText("Review queue")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Change token" })).toBeInTheDocument();
  });

  it("renders published orphan cleanup in queue maintenance", async () => {
    sessionStorage.setItem("wuf:admin_maintenance_collapsed", "0");

    renderWithProviders(
      <ReviewWorkspace
        token="test-token"
        activeTab="new"
        onActiveTabChange={vi.fn()}
        selectedId={null}
        onSelect={vi.fn()}
        onChangeToken={vi.fn()}
        onAuthFailure={vi.fn()}
      />
    );

    expect(screen.getByText("Published orphan cleanup")).toBeInTheDocument();
    expect(
      screen.getByText(/duplicate another published show/i)
    ).toBeInTheDocument();
  });
});
