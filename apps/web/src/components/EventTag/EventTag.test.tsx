import { describe, expect, it } from "vitest";

import { renderWithProviders, screen } from "@/tests/render";

import { EventTag } from "./EventTag";

describe("EventTag", () => {
  it("renders the tag label", () => {
    renderWithProviders(<EventTag>ART</EventTag>);
    expect(screen.getByTestId("event-tag")).toHaveTextContent("ART");
  });
});
