import { describe, expect, it } from "vitest";

import { resolveMapPinEmoji } from "./map-pin-emoji.js";

describe("resolveMapPinEmoji", () => {
  it("uses baseball for Grizzlies sports events", () => {
    expect(
      resolveMapPinEmoji({
        category: "sports",
        title: "Grizzlies Fireworks Night"
      })
    ).toBe("⚾");
  });

  it("returns null for generic sports without a match", () => {
    expect(
      resolveMapPinEmoji({
        category: "sports",
        title: "Community 5K Run"
      })
    ).toBeNull();
  });

  it("honors admin emoji override", () => {
    expect(
      resolveMapPinEmoji({
        category: "sports",
        title: "Grizzlies Fireworks Night",
        mapPinEmoji: "🎆"
      })
    ).toBe("🎆");
  });

  it("honors pin override for default marker", () => {
    expect(
      resolveMapPinEmoji({
        category: "music",
        title: "Jazz Night",
        mapPinEmoji: "pin"
      })
    ).toBeNull();
  });

  it("uses baseball for Grizzlies when category is community (Visit Fresno shape)", () => {
    expect(
      resolveMapPinEmoji({
        category: "community",
        title: "Fresno Tacos Night: Fresno Grizzlies vs Lake Elsinore Storm"
      })
    ).toBe("⚾");
  });

  it("does not treat Chukchansi Park venue name alone as baseball", () => {
    expect(
      resolveMapPinEmoji({
        category: "festival",
        title: "Monster Jam",
        venueName: "Save Mart Center at Chukchansi Park"
      })
    ).toBe("🎪");
  });

  it("does not treat Chukchansi in title without baseball signal as baseball", () => {
    expect(
      resolveMapPinEmoji({
        category: "community",
        title: "Community Night at Chukchansi Park"
      })
    ).toBe("✨");
  });
});
