// @vitest-environment node
import { describe, expect, it } from "vitest";

import { formatShortTime, formatPopularMeta, deriveEventTimeStatus, isLiveNow } from "./event-time";

describe("event-time", () => {
  it("strips :00 from short time", () => {
    const formatted = formatShortTime("2026-05-22T18:00:00.000-07:00");
    expect(formatted).not.toContain(":00");
  });

  it("formats popular meta as long month day and time", () => {
    expect(formatPopularMeta("2026-07-29T17:30:00.000-07:00")).toBe("July 29 - 5:30 PM");
  });

  it("detects live window", () => {
    const now = new Date("2026-05-22T19:00:00-07:00");
    const live = isLiveNow("2026-05-22T18:00:00.000-07:00", "2026-05-22T22:00:00.000-07:00", now);
    expect(live).toBe(true);
  });

  it("classifies past, live, and upcoming", () => {
    const now = new Date("2026-05-22T19:00:00-07:00");
    expect(deriveEventTimeStatus("2026-05-22T10:00:00.000-07:00", "2026-05-22T12:00:00.000-07:00", now)).toBe(
      "past"
    );
    expect(deriveEventTimeStatus("2026-05-22T18:00:00.000-07:00", "2026-05-22T22:00:00.000-07:00", now)).toBe(
      "live"
    );
    expect(deriveEventTimeStatus("2026-05-22T21:00:00.000-07:00", "2026-05-22T23:00:00.000-07:00", now)).toBe(
      "upcoming"
    );
  });
});
