import { describe, expect, it } from "vitest";

import { renderWithSiteRouter } from "@/tests/router-render";
import { screen } from "@/tests/render";

import { CalendarMonthStrip } from "./CalendarMonthStrip";

describe("CalendarMonthStrip", () => {
  it("renders month picker heading and tiles", async () => {
    await renderWithSiteRouter(<CalendarMonthStrip selectedYear={2026} selectedMonth={6} />);

    expect(screen.getByTestId("calendar-month-strip")).toBeInTheDocument();
    expect(screen.getByText("pick a")).toBeInTheDocument();
    expect(screen.getByText("MONTH")).toBeInTheDocument();
  });
});
