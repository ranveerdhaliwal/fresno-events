import { describe, expect, it, vi } from "vitest";

import { renderWithSiteRouter } from "@/tests/router-render";
import { screen } from "@/tests/render";

import { EventMapPage } from "./EventMapPage";

vi.mock("@tanstack/react-query", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@tanstack/react-query")>();
  return {
    ...actual,
    useQuery: () => ({
      data: { items: [], meta: { omittedNoCoords: 0 } },
      isLoading: false,
      error: null
    })
  };
});

vi.mock("./EventMap", () => ({
  EventMap: () => <div data-testid="event-map-stub" />
}));

describe("EventMapPage", () => {
  it("renders map page layout", async () => {
    await renderWithSiteRouter(<EventMapPage />);
    expect(screen.getByRole("heading", { name: "MAP" })).toBeInTheDocument();
    expect(screen.getByTestId("event-map-stub")).toBeInTheDocument();
  });
});
