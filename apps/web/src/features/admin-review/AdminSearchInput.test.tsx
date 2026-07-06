import { describe, expect, it, vi } from "vitest";

import { renderWithProviders, screen } from "@/tests/render";

import { AdminSearchInput } from "./AdminSearchInput";

describe("AdminSearchInput", () => {
  it("renders search input", () => {
    renderWithProviders(<AdminSearchInput onDebouncedChange={vi.fn()} />);

    expect(screen.getByRole("searchbox", { name: "Search all candidates" })).toBeInTheDocument();
  });
});
