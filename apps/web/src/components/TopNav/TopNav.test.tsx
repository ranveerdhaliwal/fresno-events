import { describe, expect, it, vi } from "vitest";

import { renderWithSiteRouter } from "@/tests/router-render";
import { screen } from "@/tests/render";

import { TopNav } from "./TopNav";

vi.mock("@/hooks/useLocalContext", () => ({
  useLocalContext: () => ({ data: undefined })
}));

describe("TopNav", () => {
  it("renders logo and primary links", async () => {
    await renderWithSiteRouter(<TopNav />);

    expect(screen.getByTestId("top-nav")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "EVENTS" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "SEARCH" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "MAP" })).toBeInTheDocument();
  });
});
