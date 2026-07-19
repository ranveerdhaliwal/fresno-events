import { describe, expect, it, vi } from "vitest";

import { renderWithSiteRouter } from "@/tests/router-render";
import { screen } from "@/tests/render";

import { PageChrome } from "./PageChrome";

vi.mock("@/hooks/useLocalContext", () => ({
  useLocalContext: () => ({ data: undefined })
}));

describe("PageChrome", () => {
  it("renders page shell with child content", async () => {
    await renderWithSiteRouter(
      <PageChrome>
        <div data-testid="page-child">Hello</div>
      </PageChrome>
    );

    expect(screen.getByTestId("top-nav")).toBeInTheDocument();
    expect(screen.getByTestId("site-footer")).toBeInTheDocument();
    expect(screen.getByTestId("home-atmosphere")).toBeInTheDocument();
    expect(screen.getByTestId("page-child")).toHaveTextContent("Hello");
  });
});
