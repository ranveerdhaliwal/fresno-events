import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { VisitFresnoResponseSchema } from "./visit-fresno-api.types";
import {
  buildVisitFresnoDateRanges,
  buildVisitFresnoUrl,
  extractVisitFresnoDocs,
  looksLikePhoneLocation,
  parseVisitFresnoSimpleTokenBody,
  parseVisitFresnoStartTs,
  parseVisitFresnoTimesField,
  parseVisitFresnoEndTs,
  resolveVisitFresnoStartMeta,
  toNormalizedEvent,
  visitFresnoTotalCount
} from "./visit-fresno-api.utils";
import { applySeriesMetadata } from "../lib/series-metadata.utils.js";

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

  it("parseVisitFresnoStartTs uses Pacific calendar date for T06:59:59 sentinel", () => {
    const cases = [
      { eventDate: "2026-06-01T06:59:59.000Z", startTime: "08:00:00", month: "5", day: "31", hour: 8 },
      { eventDate: "2026-06-01T06:59:59.000Z", startTime: "11:30:00", month: "5", day: "31", hour: 11 },
      { eventDate: "2026-06-01T06:59:59.000Z", startTime: "13:05:00", month: "5", day: "31", hour: 13 }
    ];

    for (const sample of cases) {
      const startIso = parseVisitFresnoStartTs({
        dates: { eventDate: sample.eventDate },
        startTime: sample.startTime
      } as import("./visit-fresno-api.types").VisitFresnoDoc);
      expect(startIso).toBeTruthy();

      const parts = new Intl.DateTimeFormat("en-US", {
        timeZone: "America/Los_Angeles",
        month: "numeric",
        day: "numeric",
        hour: "numeric",
        hour12: false
      }).formatToParts(new Date(startIso!));
      const get = (type: Intl.DateTimeFormatPartTypes) =>
        parts.find((p) => p.type === type)?.value ?? "";
      expect(get("month")).toBe(sample.month);
      expect(get("day")).toBe(sample.day);
      expect(Number(get("hour"))).toBe(sample.hour);
    }
  });

  it("parseVisitFresnoTimesField reads recurring Tuesday market time", () => {
    expect(parseVisitFresnoTimesField("5 pm on Tuesdays", "2026-06-02")).toBe("17:00");
    expect(parseVisitFresnoTimesField("5pm-9pm Tuesdays and 10am-2pm Saturdays", "2026-06-02")).toBe(
      "17:00"
    );
    expect(parseVisitFresnoTimesField("5pm-9pm Tuesdays and 10am-2pm Saturdays", "2026-06-06")).toBe(
      "10:00"
    );
  });

  it("parseVisitFresnoStartTs uses times when startTime is absent", () => {
    const startIso = parseVisitFresnoStartTs({
      _id: "river-4975",
      recid: "4975",
      title: "River Park Farmers Market",
      dates: { eventDate: "2026-06-03T06:59:59.000Z" },
      times: "5 pm on Tuesdays"
    } as import("./visit-fresno-api.types").VisitFresnoDoc);

    expect(startIso).toBeTruthy();
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone: "America/Los_Angeles",
      month: "numeric",
      day: "numeric",
      hour: "numeric",
      hour12: false
    }).formatToParts(new Date(startIso!));
    const get = (type: Intl.DateTimeFormatPartTypes) => parts.find((p) => p.type === type)?.value ?? "";
    expect(get("month")).toBe("6");
    expect(get("day")).toBe("2");
    expect(Number(get("hour"))).toBe(17);
  });

  it("parseVisitFresnoStartTs uses date-only sentinel when time is unknown", () => {
    const meta = resolveVisitFresnoStartMeta({
      _id: "no-time",
      recid: "1",
      title: "Mystery Event",
      dates: { eventDate: "2026-06-03T06:59:59.000Z" }
    } as import("./visit-fresno-api.types").VisitFresnoDoc);

    expect(meta?.startTs).toBe("2026-06-02T12:00:00.000Z");
    expect(meta?.timeUnknown).toBe(true);

    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone: "America/Los_Angeles",
      month: "numeric",
      day: "numeric",
      hour: "numeric",
      hour12: false
    }).formatToParts(new Date(meta!.startTs));
    const get = (type: Intl.DateTimeFormatPartTypes) => parts.find((p) => p.type === type)?.value ?? "";
    expect(get("month")).toBe("6");
    expect(get("day")).toBe("2");
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
    expect(event?.sourceEventId).toMatch(/^\d+:\d{4}-\d{2}-\d{2}$/);
    expect(event?.title.length).toBeGreaterThan(0);
    expect(event?.startTs).toMatch(/^\d{4}-\d{2}-\d{2}T/);

    const normalized = docs.map((doc) => toNormalizedEvent(doc)).filter((e) => e !== null);
    const ids = normalized.map((e) => e.sourceEventId);
    expect(new Set(ids).size).toBe(ids.length);
  }, 15_000);

  it("formats listing API descriptions with paragraphs, lists, and decoded entities", () => {
    const raw = readFileSync(fixturePath, "utf8");
    const parsed = VisitFresnoResponseSchema.parse(JSON.parse(raw));
    const docs = extractVisitFresnoDocs(parsed);
    const fashionFair = docs.find((doc) => doc.title === "Fashion Fair Family Fridays");
    expect(fashionFair).toBeDefined();
    const event = toNormalizedEvent(fashionFair!);
    expect(event?.descriptionText).toContain("July 12th - Giant Bubbles");
    expect(event?.descriptionText).toContain("Face Painting & Balloon Art");
    expect(event?.descriptionText).not.toContain("&amp;");
    expect(event?.descriptionText?.split("\n\n").length).toBeGreaterThanOrEqual(3);
  });

  it("maps API endTime onto normalized events", () => {
    const event = toNormalizedEvent({
      _id: "market-3850",
      recid: "3850",
      title: "Old Town Clovis Farmers Market",
      dates: { eventDate: "2026-06-27T06:59:59.000Z" },
      startTime: "09:00:00",
      endTime: "11:00:00",
      location: "Old Town Clovis",
      city: "Clovis",
      state: "CA"
    } as import("./visit-fresno-api.types").VisitFresnoDoc);

    expect(event?.timeUnknown).toBeFalsy();
    expect(event?.endTs).toBeTruthy();
    const endHour = Number(
      new Intl.DateTimeFormat("en-US", {
        hour: "numeric",
        hour12: false,
        timeZone: "America/Los_Angeles"
      }).format(new Date(event!.endTs!))
    );
    expect(endHour).toBe(11);
  });

  it("marks recurring listings without wall time as timeUnknown", () => {
    const event = toNormalizedEvent({
      _id: "cobra-4874",
      recid: "4874",
      title: "The Cobra Comedy Open Mic",
      dates: { eventDate: "2026-06-14T06:59:59.000Z" },
      recurrence: "Recurring weekly on Sunday",
      location: "Full Circle Brewing Company",
      city: "Fresno",
      state: "CA"
    } as import("./visit-fresno-api.types").VisitFresnoDoc);

    expect(event?.timeUnknown).toBe(true);
    expect(event?.endTs).toBeUndefined();
  });

  it("stores street-only venueAddress from full mailing lines", () => {
    const event = toNormalizedEvent({
      _id: "addr-1",
      recid: "1",
      title: "Sample Event",
      dates: { eventDate: "2026-06-03T06:59:59.000Z" },
      location: "Downtown Fresno",
      address1: "730 M Street, Fresno, CA 93721",
      city: "Fresno",
      state: "CA"
    } as import("./visit-fresno-api.types").VisitFresnoDoc);

    expect(event?.venueAddress).toBe("730 M Street");
    expect(event?.venueCity).toBe("Fresno");
  });

  it("normalizes Clovis listings and keeps the correct city", () => {
    const event = toNormalizedEvent({
      _id: "addr-clovis",
      recid: "2",
      title: "High Fitness & Hops!",
      dates: { eventDate: "2026-06-03T06:59:59.000Z" },
      location: "Some Clovis venue",
      address1: "526 Spruce Avenue, Clovis, CA 93611",
      city: "Clovis",
      state: "CA"
    } as import("./visit-fresno-api.types").VisitFresnoDoc);

    expect(event?.venueAddress).toBe("526 Spruce Avenue");
    expect(event?.venueCity).toBe("Clovis");
  });

  it("does not set seriesId in mapper; applySeriesMetadata assigns canonical id", async () => {
    const raw = {
      _id: "occ-123",
      recid: "8487",
      title: "Backyard 101 - Trivia",
      dates: { eventDate: "2026-06-03T06:59:59.000Z" },
      location: "The Backyard Social Club",
      city: "Fresno",
      recurrence: "Recurring weekly on Tuesday",
      hostname: "Backyard 101"
    };
    const mapped = toNormalizedEvent(raw);
    expect(mapped?.seriesId).toBeUndefined();
    expect(mapped?.seriesName).toBe("Recurring weekly on Tuesday");
    expect(mapped?.seriesListingRecId).toBe("8487");
    expect(mapped?.seriesPresentedBy).toBe("Backyard 101");

    const [withSeries] = await applySeriesMetadata([mapped!]);
    expect(withSeries?.seriesId).toMatch(/^series:visitfresnocounty:[a-f0-9]{64}$/);
  });

  it("uses hostname when location is a phone and maps API coordinates", () => {
    const raw = readFileSync(fixturePath, "utf8");
    const parsed = VisitFresnoResponseSchema.parse(JSON.parse(raw));
    const doc = extractVisitFresnoDocs(parsed).find((d) => d.title.includes("Civic Academy"));
    expect(doc).toBeDefined();

    const event = toNormalizedEvent(doc!);
    expect(event?.sourceEventId).toBe("8739:2026-06-02");
    expect(event?.venueName).toBe("City of Fresno Office of Community Affairs");
    expect(event?.venueAddress).toBeUndefined();
    expect(event?.venueCity).toBe("Fresno");
    expect(event?.venueLat).toBeCloseTo(36.7377981, 5);
    expect(event?.venueLng).toBeCloseTo(-119.7871247, 5);
    expect(event?.seriesPresentedBy).toBeUndefined();
  });

  it("looksLikePhoneLocation detects Visit Fresno contact phones", () => {
    expect(looksLikePhoneLocation("559-508-6421")).toBe(true);
    expect(looksLikePhoneLocation("(559) 508-6421")).toBe(true);
    expect(looksLikePhoneLocation("The Backyard Social Club")).toBe(false);
  });
});
