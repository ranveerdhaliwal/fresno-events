import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { parseMilbSchedule, toNormalizedEvents, buildMilbGamedayUrl, GRIZZLIES_DEFAULT_IMAGE_URL, GRIZZLIES_TICKETS_ORG_URL } from "./milb-api.utils";

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

  it("maps fixture schedule to Grizzlies events with gameday link and default image", () => {
    const schedule = parseMilbSchedule(JSON.parse(readFileSync(fixturePath, "utf8")));
    const events = toNormalizedEvents(schedule);
    expect(events.length).toBeGreaterThan(0);
    expect(events[0]?.source).toBe("api:milb");
    expect(events[0]?.title).toContain("Fresno Grizzlies");
    expect(events[0]?.externalUrl).toContain("milb.com/gameday/");
    expect(events[0]?.imageUrl).toBe(GRIZZLIES_DEFAULT_IMAGE_URL);
    expect(events[0]?.showVenueLogoInList).toBe(true);
    expect(events[0]?.listVenueLogoPadding).toBe(10);
    expect(events[0]?.ticketUrl).toBe(GRIZZLIES_TICKETS_ORG_URL);
  });
});
