import { describe, expect, it } from "vitest";

import { stripLeadingCalendarYear } from "./occurrence.js";

describe("stripLeadingCalendarYear", () => {
  it("removes a leading calendar year used as season noise", () => {
    expect(stripLeadingCalendarYear("2026 NSA Southwest Nationals")).toBe("NSA Southwest Nationals");
    expect(stripLeadingCalendarYear("2026 Summer Band Concerts Under the Stars Series")).toBe(
      "Summer Band Concerts Under the Stars Series"
    );
  });

  it("leaves titles without a leading year unchanged", () => {
    expect(stripLeadingCalendarYear("NSA Southwest Nationals")).toBe("NSA Southwest Nationals");
    expect(stripLeadingCalendarYear("Class of 2026")).toBe("Class of 2026");
  });
});
