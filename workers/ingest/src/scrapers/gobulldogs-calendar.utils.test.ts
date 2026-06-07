import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import {
  BULLDOGS_DEFAULT_IMAGE_URL,
  buildGobulldogsCalendarApiUrl,
  buildGobulldogsGameTitle,
  gobulldogsCalendarDaysToEvents,
  parseGobulldogsCalendarDays
} from "@/scrapers/gobulldogs-calendar.utils";

const fixtureDir = join(dirname(fileURLToPath(import.meta.url)), "__fixtures__");

describe("buildGobulldogsCalendarApiUrl", () => {
  it("builds Sidearm calendar API range", () => {
    const now = new Date("2026-06-05T12:00:00.000Z");
    expect(buildGobulldogsCalendarApiUrl(now, 90)).toBe(
      "https://gobulldogs.com/api/v2/Calendar/from/2026-06-05/to/2026-09-03"
    );
  });
});

describe("parseGobulldogsCalendarDays", () => {
  it("parses volleyball games from API fixture", () => {
    const json = JSON.parse(readFileSync(join(fixtureDir, "gobulldogs-calendar-aug.json"), "utf8"));
    const days = parseGobulldogsCalendarDays(json);
    const events = gobulldogsCalendarDaysToEvents(days);

    expect(events.length).toBeGreaterThanOrEqual(8);
    expect(events.some((e) => e.title === "Women's Volleyball at UCSB")).toBe(true);
    expect(events.some((e) => e.venueName === "Save Mart Center")).toBe(true);
    expect(events[0]?.source).toBe("api:gobulldogs");
    expect(events[0]?.timezone).toBe("America/Los_Angeles");
    expect(events[0]?.sourceEventId.startsWith("gobulldogs:game:")).toBe(true);
    expect(events.every((e) => e.imageUrl === BULLDOGS_DEFAULT_IMAGE_URL)).toBe(true);
    const football = events.find((e) => e.title.startsWith("Football"));
    expect(football?.tags).toContain("sport:football");
  });
});

describe("buildGobulldogsGameTitle", () => {
  it("formats at/vs opponents", () => {
    expect(
      buildGobulldogsGameTitle({
        id: 1,
        time: "TBA",
        atVs: "at",
        location: "Santa Barbara, CA",
        dateUtc: null,
        tbd: true,
        gameCalendarExclude: false,
        sport: { title: "Women's Volleyball", globalSportShortname: "wvball" },
        opponent: { title: "UCSB" },
        facility: null
      })
    ).toBe("Women's Volleyball at UCSB");
  });
});
