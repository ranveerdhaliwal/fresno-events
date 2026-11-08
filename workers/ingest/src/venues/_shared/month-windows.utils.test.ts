import { describe, expect, it } from "vitest";

import { buildSaveMartApiMonthRanges } from "./month-windows.utils";

describe("buildSaveMartApiMonthRanges", () => {
  it("uses the correct offset at each DST boundary, including winter and spring", () => {
    const ranges = buildSaveMartApiMonthRanges(6, new Date("2026-10-11T01:00:00Z"));
    expect(ranges[1]?.start.toISOString()).toBe("2026-11-01T07:00:00.000Z");
    expect(ranges[1]?.end.toISOString()).toBe("2026-12-01T08:00:00.000Z");
    expect(ranges[2]?.start.toISOString()).toBe(ranges[1]?.end.toISOString());
    expect(ranges[5]?.start.toISOString()).toBe("2027-03-01T08:00:00.000Z");
    expect(ranges[5]?.end.toISOString()).toBe("2027-04-01T07:00:00.000Z");
  });
  it("builds Pacific calendar month windows", () => {
    const ranges = buildSaveMartApiMonthRanges(2, new Date("2026-06-05T12:00:00Z"));
    expect(ranges).toHaveLength(2);
    expect(ranges[0]?.startYmd).toBe("2026-06-01");
    expect(ranges[0]?.endYmd).toBe("2026-06-30");
    expect(ranges[1]?.startYmd).toBe("2026-07-01");
    expect(ranges[0]?.start.getTime()).toBeLessThan(ranges[0]?.end.getTime() ?? 0);
  });
});
