import { MapContainer, TileLayer } from "react-leaflet";
import "leaflet/dist/leaflet.css";

import type { EventListItem } from "@fresno-events/shared";

import { FRESNO_CENTER, MAP_TILE_ATTRIBUTION, MAP_TILE_URL } from "@/lib/map-config";
import { groupEventsByVenue } from "./EventMap.utils";

import { EventMapClusterGroup } from "./EventMapClusterGroup";
import { EventMapFocus } from "./EventMapFocus";
import { EventMapMarkers } from "./EventMapMarkers";
import styles from "./EventMap.module.css";

export interface EventMapProps {
  items: EventListItem[];
  selectedId?: string | null;
}

function coordsForSelected(items: EventListItem[], selectedId: string | null | undefined): {
  lat: number | null;
  lng: number | null;
} {
  if (!selectedId) {
    return { lat: null, lng: null };
  }
  const match = items.find((item) => item.event.id === selectedId);
  const lat = match?.venue.lat ?? null;
  const lng = match?.venue.lng ?? null;
  if (lat == null || lng == null) {
    return { lat: null, lng: null };
  }
  return { lat, lng };
}

export function EventMap({ items, selectedId = null }: EventMapProps) {
  const groups = groupEventsByVenue(items);
  const focus = coordsForSelected(items, selectedId);

  return (
    <div className={styles.shell} data-testid="event-map">
      <MapContainer
        center={[FRESNO_CENTER.lat, FRESNO_CENTER.lng]}
        zoom={11}
        style={{ height: "100%", width: "100%" }}
      >
        <TileLayer attribution={MAP_TILE_ATTRIBUTION} url={MAP_TILE_URL} />
        <EventMapFocus lat={focus.lat} lng={focus.lng} />
        <EventMapClusterGroup>
          <EventMapMarkers groups={groups} />
        </EventMapClusterGroup>
      </MapContainer>
    </div>
  );
}
