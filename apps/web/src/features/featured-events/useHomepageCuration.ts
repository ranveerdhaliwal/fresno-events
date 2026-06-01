import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";

import {
  toFeatureCardViewModel,
  toPopularViewModels,
  type FeaturedBadge,
  type FeatureCardViewModel,
  type PopularEventViewModel
} from "@/lib/event-view-model";
import { getHomepageCuration } from "@/services/events.service";
import { eventsKeys } from "@/services/events.queryKeys";

export interface HomepageCurationViewModel {
  featuredCards: FeatureCardViewModel[];
  popularEvents: PopularEventViewModel[];
  source: "api" | "mock";
  generatedAt: string;
}

export function useHomepageCuration() {
  const query = useQuery({
    queryKey: eventsKeys.homepage(),
    queryFn: ({ signal }) => getHomepageCuration(signal),
    staleTime: 1000 * 60 * 5
  });

  const viewModel = useMemo<HomepageCurationViewModel | null>(() => {
    if (!query.data) {
      return null;
    }

    const featuredCards = query.data.featured.map((slot) => ({
      ...toFeatureCardViewModel(slot.item),
      isPinned: slot.source === "pinned"
    }));

    const popularEvents = query.data.popular.flatMap((slot, index) => {
      const mapped = toPopularViewModels([slot.item], 1)[0];
      if (!mapped) {
        return [];
      }
      return [{
        ...mapped,
        rank: index + 1,
        isPinned: slot.source === "pinned"
      }];
    });

    return {
      featuredCards,
      popularEvents,
      source: query.data.source,
      generatedAt: query.data.generatedAt
    };
  }, [query.data]);

  return { ...query, viewModel };
}

export function filterFeaturedCards(
  cards: FeatureCardViewModel[],
  tab: "all" | FeaturedBadge
): FeatureCardViewModel[] {
  if (tab === "all") {
    return cards;
  }

  return cards.filter((card) => card.isPinned || card.badge === tab || (tab === "tonight" && card.badge === "tonight"));
}
