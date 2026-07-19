import { useQuery } from "@tanstack/react-query";
import { useNavigate, useSearch } from "@tanstack/react-router";
import { useEffect, useMemo, useState, type FormEvent } from "react";

import { FilterChip } from "@/components/FilterChip";
import { PageChrome } from "@/components/PageChrome";
import { SectionTitle } from "@/components/SectionTitle";
import { Text } from "@/components/Text";
import { EventBrowseSplit } from "@/features/event-browse/EventBrowseSplit";
import {
  filterOutBeforePacificToday,
  filterOutPastItems
} from "@/features/event-browse/active-ended-events.utils";
import { useBrowseEventSelect } from "@/hooks/useIsMobile";
import { SearchPageSkeleton } from "./SearchPageSkeleton";
import { toEventRowViewModel } from "@/lib/event-view-model";
import { toIsoDateLocal } from "@/lib/event-time";
import { buildSearchSeo } from "@/lib/seo/page-seo";
import { useSeoHead } from "@/lib/seo/useSeoHead";
import { listWeekThroughSunday } from "@/services/events.service";
import { searchAll } from "@/services/search.service";

import styles from "./SearchPage.module.css";

const FILTERS = ["All", "Today", "This weekend"] as const;
type SearchFilter = (typeof FILTERS)[number];

export function SearchPage() {
  const navigate = useNavigate();
  const { q: urlQuery } = useSearch({ from: "/search" });
  const [draft, setDraft] = useState(urlQuery);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [filter, setFilter] = useState<SearchFilter>("All");
  const handleSelect = useBrowseEventSelect({
    onSelectInSplit: setSelectedId,
    onOpenEvent: (slug) => {
      void navigate({ to: "/event/$slug", params: { slug } });
    }
  });

  useSeoHead(useMemo(() => buildSearchSeo(urlQuery), [urlQuery]));

  useEffect(() => {
    setDraft(urlQuery);
  }, [urlQuery]);

  const trimmed = urlQuery.trim();
  const isSearching = trimmed.length >= 2;

  const searchQuery = useQuery({
    queryKey: ["search", trimmed],
    queryFn: ({ signal }) => searchAll(trimmed, { signal, limit: 25 }),
    enabled: isSearching,
    staleTime: 1000 * 30
  });

  const browseQuery = useQuery({
    queryKey: ["search", "browse"],
    queryFn: ({ signal }) => listWeekThroughSunday(signal),
    enabled: !isSearching,
    staleTime: 1000 * 60 * 5
  });

  const sourceItems = useMemo(() => {
    return isSearching ? (searchQuery.data?.events ?? []) : (browseQuery.data?.items ?? []);
  }, [browseQuery.data, isSearching, searchQuery.data]);

  const filteredItems = useMemo(() => {
    const now = new Date();
    // Search never shows ended events; days before today are always hidden.
    let items = filterOutPastItems(filterOutBeforePacificToday(sourceItems, now), now);
    if (filter === "All") {
      return items;
    }
    const todayIso = toIsoDateLocal(now);
    if (filter === "Today") {
      return items.filter((item) => toIsoDateLocal(new Date(item.event.startTs)) === todayIso);
    }
    const day = now.getDay();
    const daysUntilSaturday = (6 - day + 7) % 7;
    const saturday = new Date(now);
    saturday.setDate(now.getDate() + daysUntilSaturday);
    const sunday = new Date(saturday);
    sunday.setDate(saturday.getDate() + 1);
    const satIso = toIsoDateLocal(saturday);
    const sunIso = toIsoDateLocal(sunday);
    return items.filter((item) => {
      const iso = toIsoDateLocal(new Date(item.event.startTs));
      return iso === satIso || iso === sunIso;
    });
  }, [filter, sourceItems]);

  const rows = useMemo(() => filteredItems.map((item) => toEventRowViewModel(item)), [filteredItems]);
  const selected = rows.find((row) => row.id === selectedId) ?? rows[0] ?? null;
  const isLoading = isSearching ? searchQuery.isLoading : browseQuery.isLoading;
  const error = isSearching ? searchQuery.error : browseQuery.error;

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    void navigate({ to: "/search", search: { q: draft.trim() } });
  };

  return (
    <PageChrome mobileNav={{ variant: "day", title: "SEARCH" }}>
      <main className={styles.page}>
        <SectionTitle script="search" size="lg" className={styles.title ?? ""}>
          EVENTS
        </SectionTitle>
        <form onSubmit={handleSubmit}>
          <input
            className={styles.input}
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            placeholder="Search events, venues, artists…"
            aria-label="Search query"
          />
        </form>

        <div className={styles.chips}>
          {FILTERS.map((chip) => (
            <FilterChip key={chip} active={filter === chip} onClick={() => setFilter(chip)}>
              {chip}
            </FilterChip>
          ))}
        </div>

        {isLoading ? <SearchPageSkeleton /> : null}
        {error ? (
          <Text variant="body2" tone="accent" className={styles.error}>
            {error.message}
          </Text>
        ) : null}

        {!isLoading && !error ? (
          <EventBrowseSplit
            rows={rows}
            selected={selected}
            onSelect={handleSelect}
            listHeader={
              <Text variant="header2" tone="onPage" as="h2" className={styles.listHeading}>
                {isSearching ? `Results (${rows.length})` : `This week (${rows.length})`}
              </Text>
            }
            empty={
              <Text variant="body2" tone="label" className={styles.hint}>
                {isSearching ? "No events matched your search." : "No events this week yet."}
              </Text>
            }
            listFooter={
              isSearching && searchQuery.data && searchQuery.data.venues.length > 0 ? (
                <section className={styles.section}>
                  <h2>Venues ({searchQuery.data.venues.length})</h2>
                  <ul className={styles.venueList}>
                    {searchQuery.data.venues.map((venue) => (
                      <li key={venue.id}>
                        <a href={`/venue/${venue.slug}`} className={styles.venueLink}>
                          {venue.name} · {venue.city}
                        </a>
                      </li>
                    ))}
                  </ul>
                </section>
              ) : null
            }
          />
        ) : null}
      </main>
    </PageChrome>
  );
}
