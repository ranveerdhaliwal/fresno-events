import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";

import { toFeatureCardViewModel, toPopularViewModels } from "@/lib/event-view-model";
import type { FeatureCardViewModel, PopularEventViewModel } from "@/lib/event-view-model";
import { getHomepageCuration } from "@/services/events.service";
import { eventsKeys } from "@/services/events.queryKeys";

export interface HomepageCurationViewModel {
  featuredCards: FeatureCardViewModel[];
  biggestMonth: PopularEventViewModel[];
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

    const biggestMonth = toPopularViewModels(query.data.biggestMonth, 10).map((row, index) => ({
      ...row,
      rank: index + 1
    }));

    return {
      featuredCards,
      biggestMonth,
      source: query.data.source,
      generatedAt: query.data.generatedAt
    };
  }, [query.data]);

  return { ...query, viewModel };
}
