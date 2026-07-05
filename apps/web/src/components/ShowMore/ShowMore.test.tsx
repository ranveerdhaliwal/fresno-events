import { describe, expect, it } from "vitest";

import { renderWithProviders, screen } from "@/tests/render";

import { ShowMore } from "./ShowMore";

describe("ShowMore", () => {
  it("renders show more control", () => {
    renderWithProviders(<ShowMore />);
    expect(screen.getByTestId("show-more")).toHaveTextContent("SHOW MORE EVENTS");
  });
});
