import type { FeatureCardViewModel } from "@/lib/event-view-model";

export interface FeaturedCardPartition {
  heroes: FeatureCardViewModel[];
  small: FeatureCardViewModel[];
}

/** Desktop: 2 heroes + 4 small. Mobile (≤600px): 3 heroes + 4 small. */
export function partitionFeaturedCards(cards: FeatureCardViewModel[], isMobile: boolean): FeaturedCardPartition {
  if (isMobile) {
    return {
      heroes: cards.slice(0, 3),
      small: cards.slice(3, 7)
    };
  }

  return {
    heroes: cards.slice(0, 2),
    small: cards.slice(2, 6)
  };
}
