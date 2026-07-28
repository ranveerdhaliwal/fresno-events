import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import {
  BULLDOGS_DEFAULT_IMAGE_URL,
  GOBULLDOGS_FOOTBALL_SERIES_ID,
  buildGobulldogsCalendarApiUrl,
  buildGobulldogsGameTitle,
  gobulldogsCalendarDaysToEvents,
  gobulldogsGameToNormalizedEvent,
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
  const baseGame = {
    id: 1,
    time: "TBA",
    location: "Santa Barbara, CA",
    dateUtc: null,
    tbd: true,
    gameCalendarExclude: false,
    gamePromotionText: null,
    conferenceTitle: null,
    gameImageUrl: null,
    sport: { title: "Women's Volleyball", globalSportShortname: "wvball" },
    facility: null
  } as const;

  it("formats at/vs opponents", () => {
    expect(
      buildGobulldogsGameTitle({
        ...baseGame,
        atVs: "at",
        opponent: { title: "UCSB", tournamentTitle: null }
      })
    ).toBe("Women's Volleyball at UCSB");
  });

  it("uses colon for invitational doubleheaders without double vs", () => {
    expect(
      buildGobulldogsGameTitle({
        ...baseGame,
        atVs: "vs",
        location: "Fresno, CA",
        opponent: { title: "UC Irvine vs. New Mexico State", tournamentTitle: "Bulldog Invitational" }
      })
    ).toBe("Women's Volleyball: UC Irvine vs. New Mexico State");
  });

  it("uses colon for scrimmage labels", () => {
    expect(
      buildGobulldogsGameTitle({
        ...baseGame,
        atVs: "vs",
        location: "Fresno, CA",
        facility: { title: "Save Mart Center" },
        opponent: { title: "Red vs. Blue Scrimmage", tournamentTitle: null }
      })
    ).toBe("Women's Volleyball: Red vs. Blue Scrimmage");
  });

  it("trims trailing spaces from opponent names", () => {
    expect(
      buildGobulldogsGameTitle({
        ...baseGame,
        atVs: "vs",
        opponent: { title: "Northern Kentucky ", tournamentTitle: "Ohio State Tournament" }
      })
    ).toBe("Women's Volleyball vs Northern Kentucky");
  });
});

describe("gobulldogsGameToNormalizedEvent", () => {
  it("links to sport schedule without hash anchors", () => {
    const json = JSON.parse(readFileSync(join(fixtureDir, "gobulldogs-calendar-aug.json"), "utf8"));
    const days = parseGobulldogsCalendarDays(json);
    const events = gobulldogsCalendarDaysToEvents(days);
    const invitational = events.find((e) => e.sourceEventId === "gobulldogs:game:19157");

    expect(invitational?.title).toBe("Women's Volleyball: UC Irvine vs. New Mexico State");
    expect(invitational?.externalUrl).toBe("https://gobulldogs.com/sports/wvball/schedule");
    expect(invitational?.descriptionText).toContain("Bulldog Invitational");
    expect(invitational?.descriptionText).toContain("Save Mart Center");
    expect(invitational?.descriptionText).toContain("Full schedule:");
  });

  it("formats football away games like other sports", () => {
    const json = JSON.parse(readFileSync(join(fixtureDir, "gobulldogs-calendar-aug.json"), "utf8"));
    const days = parseGobulldogsCalendarDays(json);
    const events = gobulldogsCalendarDaysToEvents(days);
    const football = events.find((e) => e.title.startsWith("Football"));

    expect(football?.title).toBe("Football at USC");
    expect(football?.externalUrl).toBe("https://gobulldogs.com/sports/football/schedule");
    expect(football?.seriesId).toBeUndefined();
  });

  it("assigns season series to football home games only", () => {
    const home = gobulldogsGameToNormalizedEvent(
      {
        id: 9001,
        time: "7:00 PM",
        atVs: "vs",
        dateUtc: "2026-09-14T02:00:00.000Z",
        tbd: false,
        location: "Fresno, CA",
        gameCalendarExclude: false,
        conferenceTitle: null,
        gamePromotionText: null,
        gameImageUrl: null,
        sport: { title: "Football", globalSportShortname: "football" },
        opponent: { title: "Sacramento State", tournamentTitle: null },
        facility: { title: "Valley Children's Stadium" }
      },
      "2026-09-13"
    );
    expect(home?.title).toBe("Football vs Sacramento State");
    expect(home?.seriesId).toBe(GOBULLDOGS_FOOTBALL_SERIES_ID);

    const away = gobulldogsGameToNormalizedEvent(
      {
        id: 9002,
        time: "5:00 PM",
        atVs: "at",
        dateUtc: "2026-09-06T00:00:00.000Z",
        tbd: false,
        location: "Los Angeles, CA",
        gameCalendarExclude: false,
        conferenceTitle: null,
        gamePromotionText: null,
        gameImageUrl: null,
        sport: { title: "Football", globalSportShortname: "football" },
        opponent: { title: "USC", tournamentTitle: null },
        facility: null
      },
      "2026-09-05"
    );
    expect(away?.title).toBe("Football at USC");
    expect(away?.seriesId).toBeUndefined();
  });
});
