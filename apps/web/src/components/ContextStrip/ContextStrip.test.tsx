import { describe, expect, it } from "vitest";

import { renderWithSiteRouter } from "@/tests/router-render";
import { screen } from "@/tests/render";

import { ContextStrip } from "./ContextStrip";

describe("ContextStrip", () => {
  it("renders back link and countdown", async () => {
    await renderWithSiteRouter(<ContextStrip dayIso="2026-06-10" countdown="in 2 days" />);

    expect(screen.getByTestId("context-strip")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Back to day/i })).toHaveAttribute("href", "/day/2026-06-10");
    expect(screen.getByText("in 2 days")).toBeInTheDocument();
  });
});
