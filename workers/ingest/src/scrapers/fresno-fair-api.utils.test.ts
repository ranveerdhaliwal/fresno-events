import { describe, expect, it } from "vitest";

import {
  buildFresnoFairDateList,
  fairTimeToClock,
  fresnoFairResponseToEvents
} from "./fresno-fair-api.utils";

describe("fresno-fair-api.utils", () => {
  it("parses fair Time as HHMM Pacific clock", () => {
    expect(fairTimeToClock(600)).toBe("06:00");
    expect(fairTimeToClock(1900)).toBe("19:00");
  });

  it("builds comma-separated fair dates", () => {
    expect(buildFresnoFairDateList(2026, 10, 3)).toBe("10/01/2026,10/02/2026,10/03/2026");
  });

  it("maps API days to normalized events", () => {
    const events = fresnoFairResponseToEvents(
      {
        d: {
          Days: [
            {
              DateString: "08/21/2026",
              Times: [
                {
                  Items: [
                    {
                      EventID: 411,
                      Name: "Fresno Flea Market",
                      Date: "/Date(1787288400000)/",
                      Time: 600,
                      TimeIsSpecified: true
                    }
                  ]
                }
              ]
            }
          ]
        }
      },
      { listingUrl: "https://www.fresnofair.com/events", seriesId: "series:bigfresnofair:2026" }
    );
    expect(events).toHaveLength(1);
    expect(events[0]?.title).toBe("Fresno Flea Market");
    expect(events[0]?.startTs).toBe("2026-08-21T13:00:00.000Z");
    expect(events[0]?.seriesId).toBe("series:bigfresnofair:2026");
  });
});
