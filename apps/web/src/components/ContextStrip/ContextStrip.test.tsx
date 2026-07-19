import { describe, expect, it } from "vitest";

import { renderWithSiteRouter } from "@/tests/router-render";
import { screen } from "@/tests/render";

import { ContextStrip } from "./ContextStrip";

describe("ContextStrip", () => {
  it("renders countdown without a back-to-day link", async () => {
    await renderWithSiteRouter(<ContextStrip countdown="in 2 days" />);

    expect(screen.getByTestId("context-strip")).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /Back to day/i })).not.toBeInTheDocument();
    expect(screen.getByText("in 2 days")).toBeInTheDocument();
  });
});
