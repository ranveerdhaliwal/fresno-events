import { describe, expect, it } from "vitest";

import { renderWithProviders, screen } from "@/tests/render";

import { TextInput } from "./TextInput";

describe("TextInput", () => {
  it("renders styled input", () => {
    renderWithProviders(<TextInput aria-label="Name" defaultValue="Fresno" />);
    expect(screen.getByLabelText("Name")).toHaveValue("Fresno");
  });
});
