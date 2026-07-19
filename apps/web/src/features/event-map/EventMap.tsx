import { MapContainer, TileLayer } from "react-leaflet";
import "leaflet/dist/leaflet.css";

import type { EventListItem } from "@fresno-events/shared";

import { FRESNO_CENTER, MAP_TILE_ATTRIBUTION, MAP_TILE_URL } from "@/lib/map-config";
import { groupEventsByVenue } from "./EventMap.utils";

import { EventMapClusterGroup } from "./EventMapClusterGroup";
import { EventMapMarkers } from "./EventMapMarkers";
import styles from "./EventMap.module.css";

export interface EventMapProps {
  items: EventListItem[];
}

export function EventMap({ items }: EventMapProps) {
  const groups = groupEventsByVenue(items);

  return (
    <div className={styles.shell} data-testid="event-map">
      <MapContainer
        center={[FRESNO_CENTER.lat, FRESNO_CENTER.lng]}
        zoom={11}
        style={{ height: "100%", width: "100%" }}
      >
        <TileLayer attribution={MAP_TILE_ATTRIBUTION} url={MAP_TILE_URL} />
        <EventMapClusterGroup>
          <EventMapMarkers groups={groups} />
        </EventMapClusterGroup>
      </MapContainer>
    </div>
  );
}
