import { describe, expect, it, vi } from "vitest";

import { renderWithProviders, screen, userEvent } from "@/tests/render";

import { FilterChip } from "./FilterChip";

describe("FilterChip", () => {
  it("renders label and fires onClick", async () => {
    const onClick = vi.fn();
    renderWithProviders(
      <FilterChip active onClick={onClick}>
        TODAY
      </FilterChip>
    );

    await userEvent.click(screen.getByRole("button", { name: "TODAY" }));
    expect(onClick).toHaveBeenCalled();
  });
});
