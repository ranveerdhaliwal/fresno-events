import { describe, expect, it } from "vitest";

import {
  buildFresnoFairDateList,
  resolveFairCoordinates,
  FRESNO_FAIR_COORDINATES,
  FRESNO_FAIR_DEFAULT_VENUE_ADDRESS,
  fairTimeToClock,
  fresnoFairResponseToEvents,
  fresnoFairScheduleYearsToTry,
  parseFairTimeRangeFromText,
  parseSeriesSeasonYear,
  resolveFresnoFairScheduleYear,
  seriesIdForFresnoFairSeasonYear,
} from "./fresno-fair-api.utils";

describe("fresno-fair-api.utils", () => {
  it("keeps year-round Fairgrounds dates separate from the annual Fair parent", () => {
    const events = fresnoFairResponseToEvents(
      {
        d: {
          Days: [
            {
              DateString: "10/25/2026",
              Times: [
                {
                  Items: [
                    { EventID: 411, Name: "Fresno Flea Market", Time: 600 },
                  ],
                },
              ],
            },
            {
              DateString: "10/30/2026",
              Times: [
                {
                  Items: [
                    { EventID: 411, Name: "Fresno Flea Market", Time: 600 },
                  ],
                },
              ],
            },
          ],
        },
      },
      {
        listingUrl: "https://www.fresnofair.com/events",
        seriesId: "series:bigfresnofair:2026",
      },
    );
    expect(events.map((event) => event.seriesId)).toEqual([
      "series:fresno-fairgrounds",
      "series:fresno-fairgrounds",
    ]);
    expect(
      events.every((event) => event.venueName === "Fresno Fairgrounds"),
    ).toBe(true);
    expect(new Set(events.map((event) => event.sourceEventId)).size).toBe(2);
  });
  it("retains separate times when the CMS reuses an event ID on the same day", () => {
    const parse = (times: number[]) =>
      fresnoFairResponseToEvents(
        {
          d: {
            Days: [
              {
                DateString: "10/18/2026",
                Times: times.map((Time) => ({
                  Items: [{ EventID: 3325, Name: "Monster Trucks", Time }],
                })),
              },
            ],
          },
        },
        {
          listingUrl: "https://www.fresnofair.com/events",
          seriesId: "series:bigfresnofair:2026",
        },
      );
    const events = parse([1230, 1630]);
    for (const times of [[1230, 1630, 1930], [1630], [1630, 1230]]) {
      for (const existing of parse(times)) {
        const previous = events.find(
          (event) => event.startTs === existing.startTs,
        );
        if (previous)
          expect(existing.sourceEventId).toBe(previous.sourceEventId);
      }
    }
    expect(events.map((e) => e.sourceEventId)).toEqual([
      "venue:big-fresno-fair:3325:2026-10-18:time-1930",
      "venue:big-fresno-fair:3325:2026-10-18:time-2330",
    ]);
    expect(new Set(events.map((e) => e.sourceEventId)).size).toBe(2);
    expect(parse([1630, 1230]).map((e) => e.sourceEventId)).toEqual(
      events.map((e) => e.sourceEventId).reverse(),
    );
  });
  it("replaces CMS zero-coordinate placeholders and preserves the Fair parent", () => {
    const events = fresnoFairResponseToEvents(
      {
        d: {
          Days: [
            {
              DateString: "10/15/2026",
              Times: [
                {
                  Items: [
                    {
                      EventID: 4001,
                      Name: "Kids Town Dance Party",
                      Time: 1415,
                      Locations: [
                        { Name: "Kids Town", Latitude: 0, Longitude: 0 },
                      ],
                    },
                  ],
                },
              ],
            },
          ],
        },
      },
      {
        listingUrl: "https://www.fresnofair.com/events",
        seriesId: "series:bigfresnofair:2026",
      },
    );
    expect(events).toHaveLength(1);
    expect(events[0]?.venueLat).toBe(FRESNO_FAIR_COORDINATES.venueLat);
    expect(events[0]?.venueLng).toBe(FRESNO_FAIR_COORDINATES.venueLng);
    expect(events[0]?.seriesId).toBe("series:bigfresnofair:2026");
    expect(events[0]?.startTs).toBe("2026-10-15T21:15:00.000Z");
  });
  it("parses fair Time as HHMM Pacific clock", () => {
    expect(fairTimeToClock(600)).toBe("06:00");
    expect(fairTimeToClock(1900)).toBe("19:00");
  });

  it("builds comma-separated fair dates", () => {
    expect(buildFresnoFairDateList(2026, 10, 3)).toBe(
      "10/01/2026,10/02/2026,10/03/2026",
    );
  });

  it("ignores stale years and advances after the season in Pacific time", () => {
    expect(
      resolveFresnoFairScheduleYear(
        new Date("2027-09-01T12:00:00Z"),
        "series:bigfresnofair:2026",
      ),
    ).toBe(2027);
    expect(
      resolveFresnoFairScheduleYear(
        new Date("2026-11-08T12:00:00Z"),
        "series:bigfresnofair:2026",
      ),
    ).toBe(2027);
    expect(
      resolveFresnoFairScheduleYear(new Date("2027-11-01T06:30:00Z")),
    ).toBe(2027);
    expect(
      resolveFresnoFairScheduleYear(new Date("2027-11-01T08:30:00Z")),
    ).toBe(2028);
  });
  it("accepts an explicitly configured future season", () => {
    expect(parseSeriesSeasonYear("series:bigfresnofair:2026")).toBe(2026);
    expect(
      resolveFresnoFairScheduleYear(
        new Date("2025-06-13"),
        "series:bigfresnofair:2026",
      ),
    ).toBe(2026);
    expect(resolveFresnoFairScheduleYear(new Date("2025-06-13"))).toBe(2025);
    expect(fresnoFairScheduleYearsToTry(2026)).toEqual([2026, 2027]);
    expect(
      seriesIdForFresnoFairSeasonYear(2026, "series:bigfresnofair:2026"),
    ).toBe("series:bigfresnofair:2026");
    expect(
      seriesIdForFresnoFairSeasonYear(2027, "series:bigfresnofair:2026"),
    ).toBe("series:bigfresnofair:2027");
  });

  it("accepts API items with null LongDescription", () => {
    const events = fresnoFairResponseToEvents(
      {
        d: {
          Days: [
            {
              DateString: "10/07/2026",
              Times: [
                {
                  Items: [
                    {
                      EventID: 58,
                      Name: "4.0 & Above",
                      Date: "/Date(1791349200000)/",
                      Time: 1830,
                      TimeIsSpecified: true,
                      LongDescription: null,
                      DetailURL:
                        "https://www.fresnofair.com/events/2026/40--above",
                    },
                  ],
                },
              ],
            },
          ],
        },
      },
      {
        listingUrl: "https://www.fresnofair.com/events",
        seriesId: "series:bigfresnofair:2026",
      },
    );
    expect(events).toHaveLength(1);
    expect(events[0]?.title).toBe("4.0 & Above");
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
                      TimeIsSpecified: true,
                    },
                  ],
                },
              ],
            },
          ],
        },
      },
      {
        listingUrl: "https://www.fresnofair.com/events",
        seriesId: "series:bigfresnofair:2026",
      },
    );
    expect(events).toHaveLength(1);
    expect(events[0]?.title).toBe("Fresno Flea Market");
    expect(events[0]?.startTs).toBe("2026-08-21T13:00:00.000Z");
    expect(events[0]?.seriesId).toBe("series:fresno-fairgrounds");
    expect(events[0]?.venueAddress).toBe("1121 S. Chance Avenue");
    expect(events[0]?.venueCity).toBe("Fresno");
    expect(events[0]?.isFree).toBe(true);
    expect(events[0]?.priceMin).toBe(0);
    expect(events[0]?.priceMax).toBe(0);
  });

  it("parses time ranges from fair CMS copy", () => {
    expect(parseFairTimeRangeFromText("TIME: 10:00 AM - 1:00 PM")).toEqual({
      startClock: "10:00",
      endClock: "13:00",
    });
    expect(
      parseFairTimeRangeFromText(
        "Expo from 10 a.m. – 1 p.m. throughout the grounds",
      ),
    ).toEqual({
      startClock: "10:00",
      endClock: "13:00",
    });
  });

  it("maps Seniors' Day to 10 AM - 1 PM when API time is unspecified", () => {
    const events = fresnoFairResponseToEvents(
      {
        d: {
          Days: [
            {
              DateString: "10/12/2026",
              Times: [
                {
                  Items: [
                    {
                      EventID: 1988,
                      Name: "Seniors' Day & Expo",
                      Date: "/Date(1791781200000)/",
                      Time: 0,
                      TimeIsSpecified: false,
                      DetailURL:
                        "https://www.fresnofair.com/events/2026/seniors-day",
                      ShortDescription:
                        "Gates open at 10 a.m. Seniors will also enjoy a special Seniors' Expo from 10 a.m. – 1 p.m.",
                    },
                  ],
                },
              ],
            },
          ],
        },
      },
      { listingUrl: "https://www.fresnofair.com/events" },
    );
    expect(events).toHaveLength(1);
    expect(events[0]?.startTs).toBe("2026-10-12T17:00:00.000Z");
    expect(events[0]?.endTs).toBe("2026-10-12T20:00:00.000Z");
  });

  it("maps poster image and short description from API item fields", () => {
    const events = fresnoFairResponseToEvents(
      {
        d: {
          Days: [
            {
              DateString: "10/07/2026",
              Times: [
                {
                  Items: [
                    {
                      EventID: 3714,
                      Name: "Kansas With Starship feat. Mickey Thomas",
                      Date: "/Date(1791349200000)/",
                      Time: 1900,
                      TimeIsSpecified: true,
                      DetailURL:
                        "https://www.fresnofair.com/events/2026/kansas-starship-mickey",
                      ImageOrVideoThumbnailWithPath:
                        "https://cdn.saffire.com/images.ashx?t=ig&rid=FresnoFair&i=BFF2615_Entertainment_WebsiteBanners_Kansas_OnScreen.jpg&cb=d4dda3ed",
                      ShortDescription:
                        "Opening up the 2026 Table Mountain Concert Series on Wed, Oct 7.",
                    },
                  ],
                },
              ],
            },
          ],
        },
      },
      { listingUrl: "https://www.fresnofair.com/events" },
    );
    expect(events[0]?.imageUrl).toContain("Kansas_OnScreen.jpg");
    expect(events[0]?.descriptionText).toContain(
      "Table Mountain Concert Series",
    );
    expect(events[0]?.externalUrl).toBe(
      "https://www.fresnofair.com/events/2026/kansas-starship-mickey",
    );
  });

  it("ignores relative image paths (requires absolute http URL)", () => {
    const events = fresnoFairResponseToEvents(
      {
        d: {
          Days: [
            {
              DateString: "10/07/2026",
              Times: [
                {
                  Items: [
                    {
                      EventID: 99,
                      Name: "Relative Image Event",
                      Date: "/Date(1791349200000)/",
                      Time: 1200,
                      TimeIsSpecified: true,
                      ImageOrVideoThumbnailWithPath: "/images/poster.jpg",
                    },
                  ],
                },
              ],
            },
          ],
        },
      },
      { listingUrl: "https://www.fresnofair.com/events" },
    );
    expect(events[0]?.imageUrl).toBeUndefined();
  });

  it("uses fairgrounds default address when API location has no AddressLine1", () => {
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
                      EventID: 99,
                      Name: "Museum Day",
                      Date: "/Date(1787288400000)/",
                      Time: 1000,
                      Locations: [
                        {
                          Name: "Big Fresno Fair",
                          Latitude: 36.73,
                          Longitude: -119.75,
                        },
                      ],
                    },
                  ],
                },
              ],
            },
          ],
        },
      },
      { listingUrl: "https://www.fresnofair.com/events" },
    );
    expect(events[0]?.venueAddress).toBe("1121 S. Chance Avenue");
    expect(events[0]?.venueCity).toBe("Fresno");
    expect(FRESNO_FAIR_DEFAULT_VENUE_ADDRESS).toContain("93702");
  });
});

it("uses the verified grounds pin only for matching or omitted grounds addresses", () => {
  expect(
    resolveFairCoordinates({
      AddressLine1: "1121 S. Chance Avenue",
      Latitude: 36.778261,
      Longitude: -119.417932,
    }),
  ).toEqual(FRESNO_FAIR_COORDINATES);
  expect(
    resolveFairCoordinates({
      AddressLine1: "1121 South Chance Avenue, Fresno",
      Latitude: 36.7302,
      Longitude: -119.751,
    }),
  ).toEqual({ venueLat: 36.7302, venueLng: -119.751 });
  expect(
    resolveFairCoordinates({
      AddressLine1: "123 Another Street",
      Latitude: 0,
      Longitude: 0,
    }),
  ).toEqual({});
  expect(
    resolveFairCoordinates({
      AddressLine1: "123 Another Street",
      Latitude: 36.8,
      Longitude: -119.7,
    }),
  ).toEqual({ venueLat: 36.8, venueLng: -119.7 });
});
it("keeps multiple text-only performances instead of collapsing their zero numeric times", () => {
  const events = fresnoFairResponseToEvents(
    {
      d: {
        Days: [
          {
            DateString: "10/06/2027",
            Times: [
              {
                Items: [
                  {
                    EventID: 100,
                    Name: "Magic show",
                    Time: 0,
                    TimeDisplay: "10 a.m. - 11 a.m.",
                  },
                  {
                    EventID: 100,
                    Name: "Magic show",
                    Time: 0,
                    TimeDisplay: "1 p.m. - 2 p.m.",
                  },
                ],
              },
            ],
          },
        ],
      },
    },
    {
      listingUrl: "https://www.fresnofair.com/events",
      seriesId: "series:bigfresnofair:2027",
    },
  );
  expect(events).toHaveLength(2);
  expect(new Set(events.map((event) => event.sourceEventId)).size).toBe(2);
});
