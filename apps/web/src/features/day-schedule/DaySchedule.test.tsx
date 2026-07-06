import { describe, expect, it, vi } from "vitest";

import { renderWithSiteRouter } from "@/tests/router-render";
import { screen } from "@/tests/render";

import { DaySchedule } from "./DaySchedule";

vi.mock("./useDayEvents", () => ({
  useDayEvents: () => ({ data: { items: [] }, isLoading: false })
}));

describe("DaySchedule", () => {
  it("renders schedule sections", async () => {
    await renderWithSiteRouter(<DaySchedule isoDate="2026-06-10" onNavigateEvent={() => undefined} />);
    expect(screen.getByTestId("day-schedule")).toBeInTheDocument();
    expect(screen.getByText("LIVE OR ONGOING")).toBeInTheDocument();
  });
});
