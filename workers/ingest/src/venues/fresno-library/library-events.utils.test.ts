import { describe, expect, it } from "vitest";
import { parseLibraryEvent, type LibraryEvent } from "./library-events.utils";
import branches from "./branches.json";

const now = new Date("2026-11-06T20:00:00Z");
const until = new Date("2026-12-06T20:00:00Z");
const event: LibraryEvent = {
  id: 17437675, title: "Woodward Park: Yoga", calendar: "Woodward Park",
  startdt: "2026-11-07 10:00:00", enddt: "2026-11-07 11:00:00",
  url: "https://fresnolibrary.libcal.com/event/17437675", all_day: false, online_event: false,
  description: "<p>Join our instructor in the story room.</p>", location: "Story Room"
};

describe("library public calendar", () => {
  it("uses Pacific time and the named branch pin without inventing a free price", () => {
    const parsed = parseLibraryEvent(event, branches, now, until)!;
    expect(parsed.startTs).toBe("2026-11-07T18:00:00.000Z");
    expect(parsed.venueAddress).toBe("944 E. Perrin");
    expect(parsed.venueLat).toBe(branches["Woodward Park"].lat);
    expect(parsed.descriptionText).toContain("Room: Story Room");
    expect(parsed.isFree).toBeUndefined();
  });

  it("keeps online, all-day, cancelled and unmapped branch listings out of the physical feed", () => {
    for (const change of [{ online_event: true }, { all_day: true }, { title: "CANCELLED - Yoga" }, { calendar: "Online Events" }, { enddt: event.startdt }]) {
      expect(parseLibraryEvent({ ...event, ...change }, branches, now, until)).toBeNull();
    }
  });

  it("groups recurring programs while preserving the provider's distinct occurrence IDs", () => {
    const first = parseLibraryEvent({ ...event, recurring_event: true, calendar_id: 11204 }, branches, now, until)!;
    const second = parseLibraryEvent({ ...event, id: 17437676, startdt: "2026-11-14 10:00:00", enddt: "2026-11-14 11:00:00", recurring_event: true, calendar_id: 11204 }, branches, now, until)!;
    expect(first.seriesId).toBe(second.seriesId);
    expect(first.sourceEventId).not.toBe(second.sourceEventId);
    expect(parseLibraryEvent({ ...event, url: "https://example.com/event/123" }, branches, now, until)).toBeNull();
  });
});
