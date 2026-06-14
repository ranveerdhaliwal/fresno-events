import { describe, expect, it } from "vitest";

import {
  addDaysToIsoDate,
  buildNextPacificMonths,
  daysFromIsoThroughSunday,
  isoDateInPacificMonth,
  upcomingSundayIso
} from "./pacific-date-ranges.js";

describe("pacific-date-ranges", () => {
  it("finds upcoming Sunday from Wednesday", () => {
    expect(upcomingSundayIso("2026-06-03")).toBe("2026-06-07");
  });

  it("lists days through Sunday", () => {
    expect(daysFromIsoThroughSunday("2026-06-05")).toEqual([
      "2026-06-05",
      "2026-06-06",
      "2026-06-07"
    ]);
  });

  it("adds days across month boundary", () => {
    expect(addDaysToIsoDate("2026-06-30", 1)).toBe("2026-07-01");
  });

  it("builds 12 forward months from Pacific today", () => {
    const months = buildNextPacificMonths(12, new Date("2026-06-05T18:00:00-07:00"));
    expect(months).toHaveLength(12);
    expect(months[0]).toEqual({ year: 2026, month: 6, shortLabel: "JUN", yearLabel: "2026" });
    expect(months[11]?.month).toBe(5);
    expect(months[11]?.year).toBe(2027);
  });

  it("checks iso date in month", () => {
    expect(isoDateInPacificMonth("2026-06-15", 2026, 6)).toBe(true);
    expect(isoDateInPacificMonth("2026-07-01", 2026, 6)).toBe(false);
  });
});
