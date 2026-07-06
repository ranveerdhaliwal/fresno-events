import { describe, expect, it } from "vitest";

import { renderWithProviders, screen } from "@/tests/render";

import { TimeInput } from "./TimeInput";

describe("TimeInput", () => {
  it("renders time input", () => {
    renderWithProviders(<TimeInput aria-label="Time" defaultValue="19:30" />);
    expect(screen.getByLabelText("Time")).toHaveValue("19:30");
  });
});
