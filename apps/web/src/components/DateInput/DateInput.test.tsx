import { describe, expect, it } from "vitest";

import { renderWithProviders, screen } from "@/tests/render";

import { DateInput } from "./DateInput";

describe("DateInput", () => {
  it("renders date input", () => {
    renderWithProviders(<DateInput aria-label="Date" defaultValue="2026-06-10" />);
    expect(screen.getByLabelText("Date")).toHaveValue("2026-06-10");
  });
});
