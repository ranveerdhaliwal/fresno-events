import { useMemo, useState } from "react";
import { MapContainer, TileLayer } from "react-leaflet";
import { Link } from "@tanstack/react-router";
import "leaflet/dist/leaflet.css";

import type { EventListItem } from "@fresno-events/shared";

import type { DatePreset } from "@/lib/date-presets";
import { FRESNO_CENTER, MAP_TILE_ATTRIBUTION, MAP_TILE_URL } from "@/lib/map-config";
import { parseUrlFilters } from "@/lib/url-filters";

import { EventMapFilters } from "./EventMapFilters";
import { EventMapMarkers } from "./EventMapMarkers";
import styles from "./EventMap.module.css";
import { filterEventsForMap, groupEventsByVenue } from "./EventMap.utils";

export interface EventMapProps {
  items: EventListItem[];
  omittedNoCoords?: number;
}

export function EventMap({ items, omittedNoCoords = 0 }: EventMapProps) {
  const initialFilters = parseUrlFilters(typeof window !== "undefined" ? window.location.search : "");
  const [q, setQ] = useState(initialFilters.q);
  const [datePreset, setDatePreset] = useState<DatePreset | null>(initialFilters.datePreset);
  const [showList, setShowList] = useState(true);
  const [nearMe, setNearMe] = useState<{ lat: number; lng: number; radiusKm: number } | null>(null);

  const filtered = useMemo(
    () => filterEventsForMap(items, { q, datePreset, nearMe }),
    [items, q, datePreset, nearMe]
  );
  const groups = useMemo(() => groupEventsByVenue(filtered), [filtered]);

  return (
    <div className={styles.shell}>
      <EventMapFilters
        q={q}
        datePreset={datePreset}
        showList={showList}
        omittedNoCoords={omittedNoCoords}
        pinCount={groups.length}
        onQueryChange={setQ}
        onDatePresetChange={setDatePreset}
        onToggleList={() => setShowList((value) => !value)}
        onNearMe={() => setNearMe({ lat: FRESNO_CENTER.lat, lng: FRESNO_CENTER.lng, radiusKm: 25 })}
      />
      <div className={`${styles.body} ${showList ? styles.bodySplit : ""}`}>
        <div className={styles.mapPane}>
          <MapContainer
            center={[FRESNO_CENTER.lat, FRESNO_CENTER.lng]}
            zoom={11}
            style={{ height: "100%", width: "100%" }}
          >
            <TileLayer attribution={MAP_TILE_ATTRIBUTION} url={MAP_TILE_URL} />
            <EventMapMarkers groups={groups} />
          </MapContainer>
        </div>
        {showList ? (
          <aside className={styles.listPane}>
            {filtered.map((item) => (
              <Link
                key={item.event.id}
                to="/event/$slug"
                params={{ slug: item.event.slug }}
                className={styles.listItem}
              >
                <strong>{item.event.title}</strong>
                <div>{item.venue.name}</div>
              </Link>
            ))}
          </aside>
        ) : null}
      </div>
    </div>
  );
}
