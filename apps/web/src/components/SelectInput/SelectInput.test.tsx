import { describe, expect, it } from "vitest";

import { renderWithProviders, screen } from "@/tests/render";

import { SelectInput } from "./SelectInput";

describe("SelectInput", () => {
  it("renders select input", () => {
    renderWithProviders(
      <SelectInput aria-label="Category" defaultValue="music">
        <option value="music">Music</option>
      </SelectInput>
    );
    expect(screen.getByLabelText("Category")).toHaveValue("music");
  });
});
