import { describe, expect, it } from "vitest";

import { inferEventCategory, resolveEventCategory } from "./infer-event-category.js";

describe("inferEventCategory", () => {
  it("maps concerts and touring acts to music", () => {
    expect(inferEventCategory({ title: "SONIC Live in Concert" })).toBe("music");
    expect(
      inferEventCategory({
        title: "Grupo Duelo - GRAVEDAD TOUR 2026",
        venueName: "Selland Arena"
      })
    ).toBe("music");
  });

  it("treats named acts at Tower / Warnors as music", () => {
    expect(
      inferEventCategory({
        title: "Dailey & Vincent",
        venueName: "Tower Theatre for the Performing Arts",
        descriptionText: "730PM DOORS // 830PM SHOWTIME"
      })
    ).toBe("music");
  });

  it("keeps theater keywords ahead of music venues", () => {
    expect(
      inferEventCategory({
        title: "Mrs. Doubtfire",
        venueName: "Tower Theatre for the Performing Arts"
      })
    ).toBe("theater");
  });

  it("does not force music for trivia at a club", () => {
    expect(
      inferEventCategory({
        title: "Tuesday Trivia Night",
        venueName: "Strummer's"
      })
    ).toBe("community");
  });
});

describe("resolveEventCategory", () => {
  it("upgrades community when heuristics are stronger", () => {
    expect(
      resolveEventCategory({
        title: "Dailey & Vincent",
        venueName: "Tower Theatre for the Performing Arts",
        category: "community"
      })
    ).toBe("music");
  });

  it("leaves an explicit non-community category alone", () => {
    expect(
      resolveEventCategory({
        title: "Dailey & Vincent",
        venueName: "Tower Theatre for the Performing Arts",
        category: "festival"
      })
    ).toBe("festival");
  });
});
