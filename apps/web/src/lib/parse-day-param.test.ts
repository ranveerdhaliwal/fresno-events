// @vitest-environment node
import { describe, expect, it } from "vitest";

import { addDaysIso, dayBoundsPacific, parseDayParam } from "./parse-day-param";

describe("parseDayParam", () => {
  it("passes through a full ISO date unchanged", () => {
    expect(parseDayParam("2026-05-22")).toBe("2026-05-22");
  });

  it("expands a short day-of-month using the anchor's Pacific year and month", () => {
    const anchor = new Date("2026-07-15T18:00:00.000Z");
    expect(parseDayParam("22", anchor)).toBe("2026-07-22");
  });

  it("falls back to the anchor's local ISO date for anything else", () => {
    const anchor = new Date("2026-07-15T18:00:00.000Z");
    expect(parseDayParam("not-a-date", anchor)).toBe(parseDayParam(anchor.toISOString().slice(0, 10)));
  });
});

describe("dayBoundsPacific", () => {
  it("spans midnight to just before the next midnight, Pacific time", () => {
    const { from, until } = dayBoundsPacific("2026-07-15");

    expect(until.getTime()).toBeGreaterThan(from.getTime());
    expect(until.getTime() - from.getTime()).toBeLessThan(25 * 60 * 60 * 1000);
  });
});

describe("addDaysIso", () => {
  it("adds days across a month boundary", () => {
    expect(addDaysIso("2026-07-31", 1)).toBe("2026-08-01");
  });

  it("subtracts days across a year boundary", () => {
    expect(addDaysIso("2026-01-01", -1)).toBe("2025-12-31");
  });
});
