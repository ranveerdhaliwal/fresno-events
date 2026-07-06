import { describe, expect, it } from "vitest";

import { renderWithProviders, screen } from "@/tests/render";

import { DetailLoading } from "./DetailLoading";

describe("DetailLoading", () => {
  it("renders skeleton placeholder", () => {
    renderWithProviders(<DetailLoading />);
    expect(screen.getByTestId("detail-loading-skeleton")).toBeInTheDocument();
    expect(screen.getByTestId("detail-loading-skeleton")).toHaveAttribute("aria-busy", "true");
  });
});
