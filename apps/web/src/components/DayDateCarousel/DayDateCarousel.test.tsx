import { describe, expect, it, vi } from "vitest";

import { renderWithSiteRouter } from "@/tests/router-render";
import { screen } from "@/tests/render";

import { DayDateCarousel } from "./DayDateCarousel";

vi.mock("@/hooks/useDayStripSlotCount", () => ({
  useDayStripSlotCount: () => 7
}));

vi.mock("@/hooks/useDayStripSlideWidth", () => ({
  useDayStripSlideWidth: () => 72
}));

describe("DayDateCarousel", () => {
  it("renders carousel shell", async () => {
    await renderWithSiteRouter(
      <DayDateCarousel
        selectedIso="2026-06-10"
        onSelectDate={() => undefined}
        eventCounts={new Map()}
      />
    );

    expect(screen.getByTestId("day-date-carousel")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Pick a date" })).toBeInTheDocument();
  });
});
