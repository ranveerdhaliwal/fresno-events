import { describe, expect, it } from "vitest";

import { renderWithProviders, screen } from "@/tests/render";

import { TextArea } from "./TextArea";

describe("TextArea", () => {
  it("renders styled textarea", () => {
    renderWithProviders(<TextArea aria-label="Description" defaultValue="Details" />);
    expect(screen.getByLabelText("Description")).toHaveValue("Details");
  });
});
