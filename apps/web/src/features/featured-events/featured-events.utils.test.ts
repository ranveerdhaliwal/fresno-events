import { describe, expect, it } from "vitest";

import type { FeatureCardViewModel } from "@/lib/event-view-model";

import { partitionFeaturedCards } from "./featured-events.utils";

function card(id: string): FeatureCardViewModel {
  return {
    id,
    slug: id,
    title: id,
    description: "",
    dateLabel: "Aug 1",
    timeLabel: "7 PM",
    venueName: "Tower Theatre",
    categoryLabel: "Live music",
    paletteKey: "music",
    paletteGradient: "linear-gradient(#000, #111)",
    imageUrl: null,
    badge: "default",
    priceLabel: "$20",
    isFree: false
  };
}

const seven = Array.from({ length: 7 }, (_, index) => card(`e${index + 1}`));

describe("partitionFeaturedCards", () => {
  it("uses 2 heroes and 4 small cards on desktop", () => {
    const { heroes, small } = partitionFeaturedCards(seven, false);
    expect(heroes.map((item) => item.id)).toEqual(["e1", "e2"]);
    expect(small.map((item) => item.id)).toEqual(["e3", "e4", "e5", "e6"]);
  });

  it("uses 3 heroes and 4 small cards on mobile", () => {
    const { heroes, small } = partitionFeaturedCards(seven, true);
    expect(heroes.map((item) => item.id)).toEqual(["e1", "e2", "e3"]);
    expect(small.map((item) => item.id)).toEqual(["e4", "e5", "e6", "e7"]);
  });
});
