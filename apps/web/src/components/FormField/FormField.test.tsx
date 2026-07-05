import { describe, expect, it } from "vitest";

import { renderWithProviders, screen } from "@/tests/render";

import { FormField } from "./FormField";

describe("FormField", () => {
  it("renders label, control, and hint", () => {
    renderWithProviders(
      <FormField label="Title" hint="Required">
        <input aria-label="Title input" />
      </FormField>
    );

    expect(screen.getByText("Title")).toBeInTheDocument();
    expect(screen.getByLabelText("Title input")).toBeInTheDocument();
    expect(screen.getByText("Required")).toBeInTheDocument();
  });
});
