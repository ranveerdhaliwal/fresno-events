// @vitest-environment node
import { describe, expect, it } from "vitest";

import { formatShortTime, isLiveNow } from "./event-time";

describe("event-time", () => {
  it("strips :00 from short time", () => {
    const formatted = formatShortTime("2026-05-22T18:00:00.000-07:00");
    expect(formatted).not.toContain(":00");
  });

  it("detects live window", () => {
    const now = new Date("2026-05-22T19:00:00-07:00");
    const live = isLiveNow("2026-05-22T18:00:00.000-07:00", "2026-05-22T22:00:00.000-07:00", now);
    expect(live).toBe(true);
  });
});
