// @vitest-environment node
import { describe, expect, it } from "vitest";

import { resolveDatePreset } from "./date-presets";

describe("resolveDatePreset", () => {
  it("returns a range for week preset", () => {
    const now = new Date("2026-06-06T18:00:00.000Z");
    const range = resolveDatePreset("week", now);
    expect(range.from.getTime()).toBeLessThanOrEqual(now.getTime());
    expect(range.until.getTime()).toBeGreaterThan(range.from.getTime());
  });
});
