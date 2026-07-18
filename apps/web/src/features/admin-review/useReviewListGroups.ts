import { useEffect, useMemo } from "react";

import type { EventCandidate, EventCandidateTabCounts } from "@fresno-events/shared";

import {
  buildSeriesDisplayPriorities,
  groupCandidatesBySource,
  sortCandidatesByReviewedAt,
  sortCandidatesForSourceGroupedReview,
  type CandidateListGroup
} from "../admin/admin-priority.utils";
import { resolveActiveCandidateId } from "./admin-review-navigation.utils";
import { filterCandidatesForSearch } from "./admin-review-search.utils";

type UseReviewListGroupsOptions = {
  items: EventCandidate[];
  statusFilter: keyof EventCandidateTabCounts;
  searchQuery: string;
  priorityOverrides: Record<string, number>;
  selectedId: string | null;
  onSelect: (id: string | null) => void;
};

/**
 * Derives the grouped candidate list (source groups, search filtering, series
 * display priorities) and keeps the selected candidate id valid as the visible
 * list changes.
 */
export function useReviewListGroups({
  items,
  statusFilter,
  searchQuery,
  priorityOverrides,
  selectedId,
  onSelect
}: UseReviewListGroupsOptions) {
  const searchActive = searchQuery.trim().length >= 2;
  const isDecidedTab = statusFilter === "approved" || statusFilter === "rejected";

  const searchResults = useMemo(() => {
    if (!searchActive) {
      return [];
    }
    return filterCandidatesForSearch(items, searchQuery);
  }, [items, searchActive, searchQuery]);

  const sortedItems = useMemo(() => {
    if (isDecidedTab) {
      return sortCandidatesByReviewedAt(items);
    }
    return sortCandidatesForSourceGroupedReview(items, priorityOverrides);
  }, [items, priorityOverrides, isDecidedTab]);

  const seriesDisplayPriorities = useMemo(
    () => buildSeriesDisplayPriorities(items, priorityOverrides),
    [items, priorityOverrides]
  );

  const sourceGroups = useMemo<CandidateListGroup[]>(() => {
    if (isDecidedTab) {
      return sortedItems.length > 0
        ? [{ source: "", label: "", items: sortedItems }]
        : [];
    }
    return groupCandidatesBySource(sortedItems, priorityOverrides, seriesDisplayPriorities);
  }, [sortedItems, priorityOverrides, seriesDisplayPriorities, isDecidedTab]);

  const listGroups = useMemo<CandidateListGroup[]>(() => {
    if (!searchActive) {
      return sourceGroups;
    }
    if (searchResults.length === 0) {
      return [];
    }
    if (isDecidedTab) {
      const ordered = sortCandidatesByReviewedAt(searchResults);
      return ordered.length > 0 ? [{ source: "", label: "", items: ordered }] : [];
    }
    const searchSeriesPriorities = buildSeriesDisplayPriorities(searchResults, priorityOverrides);
    return groupCandidatesBySource(
      sortCandidatesForSourceGroupedReview(searchResults, priorityOverrides, searchSeriesPriorities),
      priorityOverrides,
      searchSeriesPriorities
    );
  }, [sourceGroups, searchActive, searchResults, priorityOverrides, isDecidedTab]);

  const visibleListItems = useMemo(() => listGroups.flatMap((group) => group.items), [listGroups]);

  const activeId = useMemo(
    () => resolveActiveCandidateId(selectedId, visibleListItems),
    [selectedId, visibleListItems]
  );

  useEffect(() => {
    const resolved = resolveActiveCandidateId(selectedId, visibleListItems);
    if (resolved !== selectedId) {
      onSelect(resolved);
    }
  }, [selectedId, visibleListItems, onSelect]);

  const listSeriesDisplayPriorities = useMemo(
    () =>
      searchActive
        ? buildSeriesDisplayPriorities(visibleListItems, priorityOverrides)
        : seriesDisplayPriorities,
    [searchActive, visibleListItems, priorityOverrides, seriesDisplayPriorities]
  );

  return {
    searchActive,
    listGroups,
    visibleListItems,
    activeId,
    listSeriesDisplayPriorities
  };
}
