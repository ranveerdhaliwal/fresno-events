import { describe, expect, it } from "vitest";

import {
  buildEventbriteFetchUnits,
  mergeEventbriteDetailForSeriesRow,
  mergeEventbriteSeriesSuffix,
  splitEventbriteSeriesDescription
} from "./eventbrite-detail-series.utils";

const CAST_A = `At this performance, double cast parts will be played by:

(in order of appearance)

Mama Ogre - Alice Example

Shrek - Bob Example

Beauty is in the eye of the ogre in Shrek The Musical JR. It's a big bright beautiful world as everyone's favorite ogre leads a cast of fairytale misfits on an adventure to rescue a princess and find true acceptance.`;

const CAST_B = `At this performance, double cast parts will be played by:

(in order of appearance)

Mama Ogre - Carol Example

Shrek - Dan Example

Beauty is in the eye of the ogre in Shrek The Musical JR. It's a big bright beautiful world as everyone's favorite ogre leads a cast of fairytale misfits on an adventure to rescue a princess and find true acceptance.`;

const IDENTICAL = "Weekly trivia night with prizes, food specials, and live hosts every Tuesday in downtown Fresno.";

describe("eventbrite-detail-series.utils", () => {
  it("splitEventbriteSeriesDescription uses suffix mode for cast-variant pages", () => {
    const split = splitEventbriteSeriesDescription(CAST_A);
    expect(split.mode).toBe("suffix");
    expect(split.suffix).toContain("Beauty is in the eye of the ogre");
    expect(split.suffix).not.toContain("Mama Ogre - Alice Example");
  });

  it("splitEventbriteSeriesDescription uses full mode for identical recurring copy", () => {
    expect(splitEventbriteSeriesDescription(IDENTICAL)).toEqual({
      mode: "full",
      suffix: IDENTICAL
    });
  });

  it("extracts the same suffix from two cast-variant performances", () => {
    const suffixA = splitEventbriteSeriesDescription(CAST_A).suffix;
    const suffixB = splitEventbriteSeriesDescription(CAST_B).suffix;
    expect(suffixA).toBe(suffixB);
  });

  it("mergeEventbriteSeriesSuffix keeps listing prefix and appends shared suffix", () => {
    const listing = {
      source: "venunite" as const,
      sourceEventId: "eb:1",
      title: "Shrek Jr.",
      venueName: "Theatre",
      startTs: "2026-06-13T01:00:00.000Z",
      descriptionText: "The Tuesday Cast of Shrek Jr. prepares to bring you a special live theatrical presentation!"
    };
    const merged = mergeEventbriteSeriesSuffix(listing, splitEventbriteSeriesDescription(CAST_A).suffix);
    expect(merged.descriptionText).toContain("Tuesday Cast of Shrek Jr.");
    expect(merged.descriptionText).toContain("Beauty is in the eye of the ogre");
    expect(merged.descriptionText).not.toContain("Mama Ogre - Alice Example");
  });

  it("mergeEventbriteDetailForSeriesRow gives representative full text and siblings suffix merge", () => {
    const listing = {
      source: "venunite" as const,
      sourceEventId: "eb:2",
      title: "Shrek Jr.",
      venueName: "Theatre",
      startTs: "2026-06-14T01:00:00.000Z",
      descriptionText: "The Saturday Cast of Shrek Jr. prepares to bring you a special live theatrical presentation!"
    };
    const detail = { descriptionText: CAST_B };

    const representative = mergeEventbriteDetailForSeriesRow(listing, detail, {
      mode: "suffix",
      isRepresentative: true
    });
    expect(representative.descriptionText).toContain("Mama Ogre - Carol Example");

    const sibling = mergeEventbriteDetailForSeriesRow(listing, detail, {
      mode: "suffix",
      isRepresentative: false
    });
    expect(sibling.descriptionText).toContain("Saturday Cast of Shrek Jr.");
    expect(sibling.descriptionText).toContain("Beauty is in the eye of the ogre");
    expect(sibling.descriptionText).not.toContain("Mama Ogre - Carol Example");
  });

  it("buildEventbriteFetchUnits groups series siblings into one fetch unit", () => {
    const seriesId = "series:venunite:abc";
    const rows = [
      {
        id: "a",
        title: "Shrek Jr.",
        eventbrite_detail_status: null,
        normalized_event: {
          source: "venunite" as const,
          sourceEventId: "eb:1",
          title: "Shrek Jr.",
          venueName: "Theatre",
          startTs: "2026-06-13T01:00:00.000Z",
          seriesId,
          externalUrl: "https://www.eventbrite.com/e/shrek-jr-tickets-111"
        }
      },
      {
        id: "b",
        title: "Shrek Jr.",
        eventbrite_detail_status: null,
        normalized_event: {
          source: "venunite" as const,
          sourceEventId: "eb:2",
          title: "Shrek Jr.",
          venueName: "Theatre",
          startTs: "2026-06-14T01:00:00.000Z",
          seriesId,
          externalUrl: "https://www.eventbrite.com/e/shrek-jr-tickets-222"
        }
      },
      {
        id: "c",
        title: "Solo Show",
        eventbrite_detail_status: null,
        normalized_event: {
          source: "venunite" as const,
          sourceEventId: "eb:3",
          title: "Solo Show",
          venueName: "Hall",
          startTs: "2026-06-15T01:00:00.000Z",
          externalUrl: "https://www.eventbrite.com/e/solo-tickets-333"
        }
      }
    ];

    const units = buildEventbriteFetchUnits(
      rows,
      (row) => row.normalized_event.externalUrl ?? null,
      new Map([[seriesId, 2]])
    );

    expect(units).toHaveLength(2);
    expect(units.find((unit) => unit.kind === "series")?.rows).toHaveLength(2);
    expect(units.find((unit) => unit.kind === "url")?.rows).toHaveLength(1);
  });
});
