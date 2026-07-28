import { describe, expect, it } from "vitest";

import { renderWithProviders, screen } from "@/tests/render";

import { SecHead } from "./SecHead";

describe("SecHead", () => {
  it("renders capitalized script, hyphen, title, and count", () => {
    renderWithProviders(<SecHead title="MORNING" script="early" count={3} />);

    expect(screen.getByTestId("sec-head")).toBeInTheDocument();
    expect(screen.getByText("Early")).toBeInTheDocument();
    expect(screen.getByText(/-/)).toBeInTheDocument();
    expect(screen.getByText("MORNING")).toBeInTheDocument();
    expect(screen.getByText("3")).toBeInTheDocument();
  });
});
