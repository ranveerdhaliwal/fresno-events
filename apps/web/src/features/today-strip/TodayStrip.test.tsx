import { describe, expect, it, vi } from "vitest";

import { renderWithSiteRouter } from "@/tests/router-render";
import { screen } from "@/tests/render";

import { TodayStrip } from "./TodayStrip";

vi.mock("@/features/featured-events/useWeekThroughSunday", () => ({
  useWeekThroughSunday: () => ({ data: { items: [] } })
}));

describe("TodayStrip", () => {
  it("renders lineup section", async () => {
    await renderWithSiteRouter(<TodayStrip />);
    expect(screen.getByTestId("lineup-section")).toBeInTheDocument();
    expect(screen.getByText("LINEUP")).toBeInTheDocument();
  });
});
