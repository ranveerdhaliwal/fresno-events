import { beforeEach, describe, expect, it, vi } from "vitest";

import { renderWithSiteRouter } from "@/tests/router-render";
import { screen } from "@/tests/render";

vi.mock("@tanstack/react-query", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@tanstack/react-query")>();
  return {
    ...actual,
    useQuery: () => ({
      data: { items: [], total: 0 },
      isLoading: false,
      isFetching: false,
      isError: false,
      error: null,
      refetch: vi.fn()
    }),
    useMutation: () => ({
      mutate: vi.fn(),
      isPending: false
    })
  };
});

import { PublishedEventsWorkspace } from "./PublishedEventsWorkspace";

describe("PublishedEventsWorkspace", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders live events workspace", async () => {
    await renderWithSiteRouter(
      <PublishedEventsWorkspace
        token="test-token"
        selectedEventId={null}
        onChangeToken={vi.fn()}
        onAuthFailure={vi.fn()}
      />,
      { initialPath: "/admin" }
    );

    expect(screen.getByText("Live events")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Change token" })).toBeInTheDocument();
    expect(screen.getByText(/Select a published event from the list/i)).toBeInTheDocument();
  });
});
