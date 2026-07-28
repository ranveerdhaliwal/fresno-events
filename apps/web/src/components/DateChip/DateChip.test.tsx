import { describe, expect, it } from "vitest";

import { renderWithProviders, screen } from "@/tests/render";

import { DateChip } from "./DateChip";

describe("DateChip", () => {
  it("renders dow and day number for the card variant", () => {
    renderWithProviders(<DateChip variant="card" dayShort="Fri" dayNum="18" />);

    expect(screen.getByText("Fri")).toBeInTheDocument();
    expect(screen.getByText("18")).toBeInTheDocument();
  });

  it("renders dow, day number, and month for the row variant", () => {
    renderWithProviders(<DateChip variant="row" dayShort="Fri" dayNum="18" monthShort="Jul" />);

    expect(screen.getByText("Fri")).toBeInTheDocument();
    expect(screen.getByText("18")).toBeInTheDocument();
    expect(screen.getByText("Jul")).toBeInTheDocument();
  });

  it("renders a single-line inline variant", () => {
    renderWithProviders(<DateChip variant="inline" dayShort="FRI" dayNum="31" />);

    expect(screen.getByTestId("date-chip-inline")).toHaveTextContent("FRI 31");
  });
});
