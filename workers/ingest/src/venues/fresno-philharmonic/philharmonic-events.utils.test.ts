import { describe, expect, it } from "vitest";
import { parsePhilharmonicDate, parsePhilharmonicListing } from "./philharmonic-events.utils";
import venues from "./venues.json";

describe("Philharmonic performance identities", () => {
  it("preserves both performances sharing a production and ticket page", () => {
    const html = `<div class="event-outer-wrapper"><h3 class="event-name">Elgar Enigma Variations</h3>
      <div class="event-date">Saturday, November 21, 2026 7:30 pm</div>
      <div class="event-date">Sunday, November 22, 2026 3:00 pm</div>
      <div class="event-date"></div><div class="event-location">Paul Shaghoian Concert Hall</div>
      <a class="event-button" href="https://fresnophil.org/events/elgar-enigma-variations/">Details</a></div>`;
    const events = parsePhilharmonicListing(html, venues, new Date("2026-11-06T20:00:00Z"));
    expect(events.map(event => event.startTs)).toEqual(["2026-11-22T03:30:00.000Z", "2026-11-22T23:00:00.000Z"]);
    expect(events[0]!.sourceEventId).not.toBe(events[1]!.sourceEventId);
    expect(events.every(event => event.venueAddress === "2770 E International Ave")).toBe(true);
  });

  it("handles Pacific daylight saving transitions and ignores unannounced times", () => {
    expect(parsePhilharmonicDate("Sunday, November 1, 2026 | 3:00 pm")).toBe("2026-11-01T23:00:00.000Z");
    expect(parsePhilharmonicDate("Saturday, March 20, 2027 | 7:30 pm")).toBe("2027-03-21T02:30:00.000Z");
    expect(parsePhilharmonicDate("Saturday, March 20, 2027 TBA")).toBeNull();
  });
});
