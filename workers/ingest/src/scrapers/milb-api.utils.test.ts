import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { parseMilbSchedule, toNormalizedEvents, buildMilbGamedayUrl, GRIZZLIES_DEFAULT_IMAGE_URL, GRIZZLIES_TICKETS_ORG_URL, GRIZZLIES_SEASON_SERIES_ID } from "./milb-api.utils";

const fixturePath = join(process.cwd(), "../../tools/spikes/fixtures/milb-sample.json");

describe("milb-api.utils", () => {
  it("builds gameday preview URLs from away-vs-home slug", () => {
    const url = buildMilbGamedayUrl({
      gamePk: 821367,
      gameDate: "2026-08-24T00:05:00Z",
      officialDate: "2026-08-23",
      teams: {
        away: { team: { id: 524, name: "Stockton Ports", teamName: "Ports" } },
        home: { team: { id: 259, name: "Fresno Grizzlies", teamName: "Grizzlies" } }
      }
    });
    expect(url).toBe("https://www.milb.com/gameday/ports-vs-grizzlies/2026/08/23/821367/preview");
  });

  it("maps fixture schedule to Grizzlies home events with season series", () => {
    const schedule = parseMilbSchedule(JSON.parse(readFileSync(fixturePath, "utf8")));
    const events = toNormalizedEvents(schedule);
    expect(events.length).toBeGreaterThan(0);
    expect(events.every((event) => event.title.includes(" vs "))).toBe(true);
    expect(events.every((event) => event.seriesId === GRIZZLIES_SEASON_SERIES_ID)).toBe(true);
    expect(events[0]?.source).toBe("api:milb");
    expect(events[0]?.title).toContain("Fresno Grizzlies");
    expect(events[0]?.externalUrl).toContain("milb.com/gameday/");
    expect(events[0]?.imageUrl).toBe(GRIZZLIES_DEFAULT_IMAGE_URL);
    expect(events[0]?.showVenueLogoInList).toBe(true);
    expect(events[0]?.listVenueLogoPadding).toBe(10);
    expect(events[0]?.ticketUrl).toBe(GRIZZLIES_TICKETS_ORG_URL);
  });

  it("drops Grizzlies away games from the local calendar", () => {
    const events = toNormalizedEvents({
      dates: [
        {
          games: [
            {
              gamePk: 1,
              gameDate: "2026-07-30T01:35:00Z",
              officialDate: "2026-07-29",
              venue: { name: "ONT Field" },
              teams: {
                away: { team: { id: 259, name: "Fresno Grizzlies", teamName: "Grizzlies" } },
                home: { team: { id: 1, name: "Ontario Tower Buzzers", teamName: "Tower Buzzers" } }
              }
            },
            {
              gamePk: 2,
              gameDate: "2026-08-05T01:50:00Z",
              officialDate: "2026-08-04",
              venue: { name: "Chukchansi Park" },
              teams: {
                away: { team: { id: 1, name: "Ontario Tower Buzzers", teamName: "Tower Buzzers" } },
                home: { team: { id: 259, name: "Fresno Grizzlies", teamName: "Grizzlies" } }
              }
            }
          ]
        }
      ]
    });
    expect(events).toHaveLength(1);
    expect(events[0]?.sourceEventId).toBe("2");
    expect(events[0]?.venueName).toBe("Chukchansi Park");
    expect(events[0]?.venueCity).toBe("Fresno");
    expect(events[0]?.seriesId).toBe(GRIZZLIES_SEASON_SERIES_ID);
  });
});
