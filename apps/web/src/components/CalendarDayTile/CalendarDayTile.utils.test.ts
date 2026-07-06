import { describe, expect, it } from "vitest";

import { isPacificWeekend, pacificDowShort } from "./CalendarDayTile.utils";

describe("pacificDowShort", () => {
  it("returns SUN for a known Sunday", () => {
    expect(pacificDowShort("2026-06-07")).toBe("SUN");
  });

  it("returns WED for a known Wednesday", () => {
    expect(pacificDowShort("2026-06-10")).toBe("WED");
  });
});

describe("isPacificWeekend", () => {
  it("detects Saturday and Sunday", () => {
    expect(isPacificWeekend("2026-06-07")).toBe(true);
    expect(isPacificWeekend("2026-06-06")).toBe(true);
    expect(isPacificWeekend("2026-06-10")).toBe(false);
  });
});
