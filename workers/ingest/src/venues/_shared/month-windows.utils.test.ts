import { describe, expect, it } from "vitest";

import { buildSaveMartApiMonthRanges } from "./month-windows.utils";

describe("buildSaveMartApiMonthRanges", () => {
  it("builds Pacific calendar month windows", () => {
    const ranges = buildSaveMartApiMonthRanges(2, new Date("2026-06-05T12:00:00Z"));
    expect(ranges).toHaveLength(2);
    expect(ranges[0]?.startYmd).toBe("2026-06-01");
    expect(ranges[0]?.endYmd).toBe("2026-06-30");
    expect(ranges[1]?.startYmd).toBe("2026-07-01");
    expect(ranges[0]?.start.getTime()).toBeLessThan(ranges[0]?.end.getTime() ?? 0);
  });
});
