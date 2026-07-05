import { describe, expect, it } from "vitest";

import { renderWithProviders, screen } from "@/tests/render";

import { PlaceholderImage } from "./PlaceholderImage";

describe("PlaceholderImage", () => {
  it("renders gradient placeholder with label", () => {
    renderWithProviders(<PlaceholderImage paletteKey="festival" label="LIVE MUSIC" />);
    expect(screen.getByTestId("placeholder-image")).toBeInTheDocument();
    expect(screen.getByText("LIVE MUSIC")).toBeInTheDocument();
  });

  it("renders photo when imageUrl is set", () => {
    renderWithProviders(
      <PlaceholderImage paletteKey="festival" label="LIVE MUSIC" imageUrl="https://example.com/x.jpg" alt="Show" />
    );
    expect(screen.getByRole("img", { name: "Show" })).toBeInTheDocument();
  });
});
