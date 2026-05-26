import { describe, expect, it } from "vitest";

import { formatPacificLogTimestamp } from "@/lib/structured-log";

describe("formatPacificLogTimestamp", () => {
  it("formats in 12-hour Pacific style", () => {
    const formatted = formatPacificLogTimestamp(new Date("2026-05-26T19:30:00.000Z"));
    expect(formatted).toMatch(/AM|PM/);
    expect(formatted.length).toBeGreaterThan(10);
  });
});
