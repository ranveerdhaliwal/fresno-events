import { describe, expect, it, vi } from "vitest";

import { renderWithSiteRouter } from "@/tests/router-render";
import { screen } from "@/tests/render";

import { TodayStrip } from "./TodayStrip";

vi.mock("./useForwardDayEvents", () => ({
  useForwardDayEvents: () => ({ data: { items: [] } })
}));

describe("TodayStrip", () => {
  it("renders lineup section without filter chips", async () => {
    await renderWithSiteRouter(<TodayStrip />);
    expect(screen.getByTestId("lineup-section")).toBeInTheDocument();
    expect(screen.getByText("LINEUP")).toBeInTheDocument();
    expect(screen.getByText("The")).toBeInTheDocument();
    expect(screen.queryByText("THIS MONTH")).not.toBeInTheDocument();
  });
});
