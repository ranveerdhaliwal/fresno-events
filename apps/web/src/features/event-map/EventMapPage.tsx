import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";

import type { ApiResponse, EventListResponse } from "@fresno-events/shared";

import { EventRow } from "@/components/EventRow";
import { PageChrome } from "@/components/PageChrome";
import { toEventRowViewModel } from "@/lib/event-view-model";

import { EventMap } from "./EventMap";
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
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const query = useQuery({
    queryKey: ["event-map"],
    queryFn: fetchMapEvents,
    staleTime: 1000 * 60
  });

  const rows = useMemo(() => (query.data?.items ?? []).map((item) => toEventRowViewModel(item)), [query.data]);

  return (
    <PageChrome mobileNav={{ variant: "day", title: "MAP" }}>
      <div className={styles.page}>
        <header className={styles.header}>
          <h1 className={styles.title}>Map</h1>
          <p className={styles.meta}>{rows.length} pinned events</p>
        </header>
        {query.isLoading ? <p className={styles.meta}>Loading events…</p> : null}
        {query.error ? <p className={styles.meta}>{query.error.message}</p> : null}
        {query.data ? (
          <div className={styles.layout}>
            <aside className={styles.sidebar}>
              {rows.map((row) => (
                <EventRow
                  key={row.id}
                  event={row}
                  isSelected={selectedId === row.id}
                  onSelect={() => setSelectedId(row.id)}
                  showImage={false}
                />
              ))}
            </aside>
            <EventMap items={query.data.items} omittedNoCoords={query.data.meta?.omittedNoCoords ?? 0} />
          </div>
        ) : null}
      </div>
    </PageChrome>
  );
}
