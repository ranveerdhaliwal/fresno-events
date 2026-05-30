import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { VisitFresnoResponseSchema } from "./visit-fresno-api.types";
import {
  buildVisitFresnoDateRanges,
  buildVisitFresnoUrl,
  extractVisitFresnoDocs,
  parseVisitFresnoSimpleTokenBody,
  parseVisitFresnoStartTs,
  toNormalizedEvent,
  visitFresnoTotalCount
} from "./visit-fresno-api.utils";

const fixturePath = join(import.meta.dirname, "fixtures/visit-fresno-response.json");

describe("visit-fresno-api.utils", () => {
  it("parseVisitFresnoSimpleTokenBody accepts plain-text token", () => {
    expect(parseVisitFresnoSimpleTokenBody("9ad7b23a6ed7705ee3a0e0c6f68c7211\n")).toBe(
      "9ad7b23a6ed7705ee3a0e0c6f68c7211"
    );
  });

  it("buildVisitFresnoDateRanges splits a 30-day horizon into weekly windows", () => {
    const ranges = buildVisitFresnoDateRanges(new Date("2026-05-23T12:00:00Z"));
    expect(ranges.length).toBeGreaterThanOrEqual(4);
    expect(ranges[0]?.start.toISOString().slice(0, 10)).toBe("2026-05-23");
  });

  it("buildVisitFresnoUrl includes json filter and token", () => {
    const now = new Date("2026-05-23T12:00:00Z");
    const [range] = buildVisitFresnoDateRanges(now);
    expect(range).toBeDefined();
    const url = buildVisitFresnoUrl({
      token: "test-token",
      skip: 0,
      limit: 50,
      range: range!
    });
    expect(url).toContain("plugins_events_events_by_date");
    expect(url).toContain("token=test-token");
    expect(url).toContain("json=");
  });

  it("parseVisitFresnoStartTs uses startTime instead of 06:59:59 sentinel", () => {
    const raw = readFileSync(fixturePath, "utf8");
    const parsed = VisitFresnoResponseSchema.parse(JSON.parse(raw));
    const doc = extractVisitFresnoDocs(parsed).find((d) => d.startTime?.startsWith("19:"));
    expect(doc).toBeDefined();

    const startIso = parseVisitFresnoStartTs(doc!);
    expect(startIso).toBeTruthy();

    const pacificHour = Number(
      new Intl.DateTimeFormat("en-US", {
        hour: "numeric",
        hour12: false,
        timeZone: "America/Los_Angeles"
      }).format(new Date(startIso!))
    );
    expect(pacificHour).toBe(19);
    expect(pacificHour).not.toBe(23);
  });

  it("maps fixture docs to NormalizedEvent", () => {
    const raw = readFileSync(fixturePath, "utf8");
    const parsed = VisitFresnoResponseSchema.parse(JSON.parse(raw));
    const docs = extractVisitFresnoDocs(parsed);
    expect(docs.length).toBeGreaterThan(0);
    expect(visitFresnoTotalCount(parsed)).toBeGreaterThan(0);

    const firstDoc = docs[0];
    expect(firstDoc).toBeDefined();
    const event = toNormalizedEvent(firstDoc!);
    expect(event).not.toBeNull();
    expect(event?.source).toBe("api:visitfresnocounty");
    expect(event?.sourceEventId).toBe(firstDoc!._id);
    expect(event?.title.length).toBeGreaterThan(0);
    expect(event?.startTs).toMatch(/^\d{4}-\d{2}-\d{2}T/);

    const normalized = docs.map((doc) => toNormalizedEvent(doc)).filter((e) => e !== null);
    const ids = normalized.map((e) => e.sourceEventId);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
