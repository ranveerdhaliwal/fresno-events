import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";

import type { ApiResponse, EventListResponse } from "@fresno-events/shared";

import { EventRow } from "@/components/EventRow";
import { PageChrome } from "@/components/PageChrome";
import { SectionTitle } from "@/components/SectionTitle";
import { Text } from "@/components/Text";
import { toEventRowViewModel } from "@/lib/event-view-model";
import type { DatePreset } from "@/lib/date-presets";
import { FRESNO_CENTER } from "@/lib/map-config";
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

  const from = new Date();
  const until = new Date(from.getTime() + 14 * 24 * 60 * 60 * 1000);
  const params = new URLSearchParams({
    from: from.toISOString(),
    until: until.toISOString(),
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
  const [datePreset, setDatePreset] = useState<DatePreset | null>(initialFilters.datePreset);
  const [nearMe, setNearMe] = useState<{ lat: number; lng: number; radiusKm: number } | null>(null);

  useSeoHead(buildMapSeo());
  const query = useQuery({
    queryKey: ["event-map"],
    queryFn: fetchMapEvents,
    staleTime: 1000 * 60
  });

  const filteredItems = useMemo(
    () => filterEventsForMap(query.data?.items ?? [], { q, datePreset, nearMe }),
    [query.data?.items, q, datePreset, nearMe]
  );

  const rows = useMemo(
    () => filteredItems.map((item) => toEventRowViewModel(item)),
    [filteredItems]
  );

  return (
    <PageChrome mobileNav={{ variant: "day", title: "MAP" }}>
      <div className={styles.page}>
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
          <div className={styles.layout}>
            <aside className={styles.sidebar}>
              <EventMapFilters
                q={q}
                datePreset={datePreset}
                omittedNoCoords={query.data.meta?.omittedNoCoords ?? 0}
                pinCount={rows.length}
                onQueryChange={setQ}
                onDatePresetChange={setDatePreset}
                onNearMe={() => setNearMe({ lat: FRESNO_CENTER.lat, lng: FRESNO_CENTER.lng, radiusKm: 25 })}
              />
              <div className={styles.sidebarList}>
                {rows.map((row) => (
                  <EventRow
                    key={row.id}
                    event={row}
                    isSelected={selectedId === row.id}
                    onSelect={() => setSelectedId(row.id)}
                  />
                ))}
              </div>
            </aside>
            <EventMap items={filteredItems} />
          </div>
        ) : null}
      </div>
    </PageChrome>
  );
}
