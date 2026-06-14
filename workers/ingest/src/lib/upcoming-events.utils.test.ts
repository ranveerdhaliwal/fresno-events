import { describe, expect, it } from "vitest";

import { filterUpcomingIngestEvents, isPastPacificEvent } from "./upcoming-events.utils";

describe("upcoming-events.utils", () => {
  const now = new Date("2026-06-13T20:00:00.000Z");

  it("treats earlier Pacific dates as past", () => {
    expect(isPastPacificEvent("2026-03-21T21:00:00.000Z", now)).toBe(true);
    expect(isPastPacificEvent("2026-05-23T03:00:00.000Z", now)).toBe(true);
  });

  it("keeps today and future Pacific dates", () => {
    expect(isPastPacificEvent("2026-06-13T07:00:00.000Z", now)).toBe(false);
    expect(isPastPacificEvent("2026-10-03T03:00:00.000Z", now)).toBe(false);
  });

  it("filters past events from a batch", () => {
    const events = filterUpcomingIngestEvents(
      [
        {
          source: "scrape:events.fresnoconventioncenter.com",
          sourceEventId: "venue:fresno-convention-center:shen-yun",
          title: "Shen Yun",
          venueName: "Saroyan Theatre",
          startTs: "2026-03-21T21:00:00.000Z"
        },
        {
          source: "api:ticketmaster",
          sourceEventId: "tm-1",
          title: "SONIC Live in Concert",
          venueName: "Saroyan Theatre",
          startTs: "2026-10-03T03:00:00.000Z"
        }
      ],
      now
    );

    expect(events.map((event) => event.sourceEventId)).toEqual(["tm-1"]);
  });
});
