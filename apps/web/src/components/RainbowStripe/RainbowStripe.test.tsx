import { describe, expect, it } from "vitest";

import { renderWithProviders, screen } from "@/tests/render";

import { RainbowStripe } from "./RainbowStripe";

describe("RainbowStripe", () => {
  it("renders desktop stripe", () => {
    renderWithProviders(<RainbowStripe variant="desktop" />);
    expect(screen.getByTestId("rainbow-stripe")).toBeInTheDocument();
  });
});
