import { describe, expect, it, vi } from "vitest";

import { renderWithSiteRouter } from "@/tests/router-render";
import { screen } from "@/tests/render";

import { SearchPage } from "./SearchPage";

vi.mock("@tanstack/react-router", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@tanstack/react-router")>();
  return {
    ...actual,
    useNavigate: () => vi.fn(),
    useSearch: () => ({ q: "" })
  };
});

vi.mock("@tanstack/react-query", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@tanstack/react-query")>();
  return {
    ...actual,
    useQuery: () => ({
      data: { items: [] },
      isLoading: false,
      error: null
    })
  };
});

describe("SearchPage", () => {
  it("renders search page chrome", async () => {
    await renderWithSiteRouter(<SearchPage />);
    expect(screen.getByPlaceholderText(/Search events/i)).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /EVENTS/i })).toBeInTheDocument();
  });
});
