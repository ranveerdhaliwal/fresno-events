import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { parseFrom, parseLimit, parseMaxPriority, parseOptionalDate } from "./events.utils";

describe("parseLimit", () => {
  it("defaults invalid input to 12", () => {
    expect(parseLimit(undefined)).toBe(12);
    expect(parseLimit("not-a-number")).toBe(12);
  });

  it("treats empty string as zero then clamps to minimum 1", () => {
    expect(parseLimit("")).toBe(1);
  });

  it("clamps to 1..50", () => {
    expect(parseLimit("0")).toBe(1);
    expect(parseLimit("1")).toBe(1);
    expect(parseLimit("50")).toBe(50);
    expect(parseLimit("99")).toBe(50);
    expect(parseLimit("3.7")).toBe(3);
  });
});

describe("parseFrom", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-05-10T12:00:00.000Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns null for invalid ISO string", () => {
    expect(parseFrom("invalid")).toBeNull();
  });

  it("parses valid ISO string", () => {
    const d = parseFrom("2026-01-15T08:00:00.000Z");
    expect(d).toBeInstanceOf(Date);
    expect(d?.toISOString()).toBe("2026-01-15T08:00:00.000Z");
  });

  it("defaults to six hours before now when omitted", () => {
    const d = parseFrom(undefined);
    expect(d).toBeInstanceOf(Date);
    expect(d?.toISOString()).toBe("2026-05-10T06:00:00.000Z");
  });
});

describe("parseOptionalDate", () => {
  it("returns undefined when omitted", () => {
    expect(parseOptionalDate(undefined)).toBeUndefined();
  });

  it("returns null for invalid value", () => {
    expect(parseOptionalDate("bad")).toBeNull();
  });

  it("parses valid ISO string", () => {
    expect(parseOptionalDate("2026-03-01T00:00:00.000Z")?.toISOString()).toBe("2026-03-01T00:00:00.000Z");
  });
});

describe("parseMaxPriority", () => {
  it("returns undefined when omitted", () => {
    expect(parseMaxPriority(undefined)).toBeUndefined();
  });

  it("returns null for invalid values", () => {
    expect(parseMaxPriority("bad")).toBeNull();
    expect(parseMaxPriority("6")).toBeNull();
    expect(parseMaxPriority("-1")).toBeNull();
  });

  it("parses integers 0–5", () => {
    expect(parseMaxPriority("0")).toBe(0);
    expect(parseMaxPriority("5")).toBe(5);
  });
});
