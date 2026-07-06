import { describe, expect, it } from "vitest";

import { renderWithSiteRouter } from "@/tests/router-render";
import { screen } from "@/tests/render";
import { buildDayStripTilesThroughSunday } from "@/lib/event-view-model";

import { DayStrip } from "./DayStrip";
import { DayStripTiles } from "./DayStripTiles";
import { DayStripPickDate } from "./DayStripPickDate";

describe("DayStrip", () => {
  const tiles = buildDayStripTilesThroughSunday(new Date("2026-06-10T12:00:00-07:00"), new Map());

  it("renders day strip", async () => {
    await renderWithSiteRouter(<DayStrip tiles={tiles} selectedIso="2026-06-10" />);
    expect(screen.getByTestId("day-strip")).toBeInTheDocument();
  });
});

describe("DayStripTiles", () => {
  const tiles = buildDayStripTilesThroughSunday(new Date("2026-06-10T12:00:00-07:00"), new Map());

  it("renders tile labels", async () => {
    await renderWithSiteRouter(<DayStripTiles tiles={tiles.slice(0, 1)} />);
    expect(screen.getByText("0 events")).toBeInTheDocument();
  });
});

describe("DayStripPickDate", () => {
  it("links to calendar", async () => {
    await renderWithSiteRouter(<DayStripPickDate />);
    expect(screen.getByRole("link", { name: "Pick a date" })).toHaveAttribute("href", expect.stringContaining("/calendar"));
  });
});
