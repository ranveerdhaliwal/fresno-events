import { describe, expect, it } from "vitest";

import { renderWithSiteRouter } from "@/tests/router-render";
import { screen } from "@/tests/render";

import { PlaceholderPage } from "./PlaceholderPage";

describe("PlaceholderPage", () => {
  it("renders eyebrow, title, and back link", async () => {
    await renderWithSiteRouter(
      <PlaceholderPage
        eyebrow="Coming soon"
        title="Saved events"
        description="Not built yet."
        canonicalPath="/saved"
      />
    );

    expect(screen.getByTestId("placeholder-page")).toBeInTheDocument();
    expect(screen.getByText("Saved events")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Back to events/i })).toHaveAttribute("href", "/");
  });
});
