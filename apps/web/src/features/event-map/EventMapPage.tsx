import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";

import type { ApiResponse, EventListResponse } from "@fresno-events/shared";

import { PageChrome } from "@/components/PageChrome";
import { SectionTitle } from "@/components/SectionTitle";
import { SelectableEventRow } from "@/components/SelectableEventRow";
import { Text } from "@/components/Text";
import { filterOutPastItems } from "@/features/event-browse/active-ended-events.utils";
import { toEventRowViewModel } from "@/lib/event-view-model";
import type { DatePreset } from "@/lib/date-presets";
import { resolveDatePreset } from "@/lib/date-presets";
import { parseUrlFilters } from "@/lib/url-filters";
import { buildMapSeo } from "@/lib/seo/page-seo";
import { useSeoHead } from "@/lib/seo/useSeoHead";

import { EventMap } from "./EventMap";
import { EventMapFilters } from "./EventMapFilters";
import { EventMapPageSkeleton } from "./EventMapPageSkeleton";
import { filterEventsForMap } from "./EventMap.utils";
import styles from "./EventMap.module.css";

function getApiUrl() {
  const value = import.meta.env.VITE_API_URL?.trim();
  return value ? value : null;
}

async function fetchMapEvents(): Promise<EventListResponse> {
  const apiUrl = getApiUrl();
  if (!apiUrl) {
    throw new Error("VITE_API_URL is not set.");
  }

  const range = resolveDatePreset("week");
  const params = new URLSearchParams({
    from: range.from.toISOString(),
    until: range.until.toISOString(),
    limit: "100",
    require_coords: "true"
  });

  const response = await fetch(new URL(`/events?${params}`, apiUrl), {
    headers: { Accept: "application/json" }
  });
  const payload = (await response.json()) as ApiResponse<EventListResponse>;
  if (!payload.ok) {
    throw new Error(payload.error.message);
  }
  return payload.data;
}

export function EventMapPage() {
  const initialFilters = parseUrlFilters(typeof window !== "undefined" ? window.location.search : "");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [q, setQ] = useState(initialFilters.q);
  const [datePreset, setDatePreset] = useState<DatePreset>(initialFilters.datePreset ?? "week");

  useSeoHead(buildMapSeo());
  const query = useQuery({
    queryKey: ["event-map"],
    queryFn: fetchMapEvents,
    staleTime: 1000 * 60
  });

  const filteredItems = useMemo(() => {
    const base = filterOutPastItems(query.data?.items ?? []);
    return filterEventsForMap(base, { q, datePreset });
  }, [query.data?.items, q, datePreset]);

  const rows = useMemo(
    () => filteredItems.map((item) => toEventRowViewModel(item)),
    [filteredItems]
  );

  return (
    <PageChrome mobileNav={{ variant: "day", title: "MAP" }}>
      <div className={styles.page} data-testid="event-map-page">
        <header className={styles.header}>
          <SectionTitle size="md" as="h1" className={styles.title}>
            MAP
          </SectionTitle>
          <Text variant="body2" tone="label" className={styles.meta}>
            {rows.length} events on map
          </Text>
        </header>
        {query.isLoading ? <EventMapPageSkeleton /> : null}
        {query.error ? (
          <Text variant="body2" tone="label" className={styles.meta}>
            {query.error.message}
          </Text>
        ) : null}
        {query.data ? (
          <div className={styles.body}>
            <EventMapFilters
              q={q}
              datePreset={datePreset}
              omittedNoCoords={query.data.meta?.omittedNoCoords ?? 0}
              pinCount={rows.length}
              onQueryChange={setQ}
              onDatePresetChange={setDatePreset}
            />
            <div className={styles.layout}>
              <aside className={styles.sidebar}>
                <div className={styles.sidebarList}>
                  {rows.map((row) => (
                    <SelectableEventRow
                      key={row.id}
                      event={row}
                      isSelected={selectedId === row.id}
                      onSelect={(id) => setSelectedId(id)}
                    />
                  ))}
                </div>
              </aside>
              <div className={styles.mapPane}>
                <EventMap items={filteredItems} selectedId={selectedId} />
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </PageChrome>
  );
}
