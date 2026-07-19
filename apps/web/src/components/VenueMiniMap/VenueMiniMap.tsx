import L from "leaflet";
import { useMemo } from "react";
import { MapContainer, Marker, TileLayer, ZoomControl } from "react-leaflet";

import { MAP_TILE_ATTRIBUTION, MAP_TILE_URL } from "@/lib/map-config";

import type { VenueMiniMapProps } from "./VenueMiniMap.types";
import styles from "./VenueMiniMap.module.css";

import markerIcon2x from "leaflet/dist/images/marker-icon-2x.png";
import markerIcon from "leaflet/dist/images/marker-icon.png";
import markerShadow from "leaflet/dist/images/marker-shadow.png";

function defaultMapPinIcon() {
  return L.icon({
    iconUrl: markerIcon,
    iconRetinaUrl: markerIcon2x,
    shadowUrl: markerShadow,
    iconSize: [25, 41],
    iconAnchor: [12, 41],
    popupAnchor: [1, -34],
    shadowSize: [41, 41]
  });
}

export function VenueMiniMap({ lat, lng, height = 200 }: VenueMiniMapProps) {
  const icon = useMemo(() => defaultMapPinIcon(), []);

  return (
    <div className={styles.map} style={{ height }}>
      <MapContainer
        center={[lat, lng]}
        zoom={16}
        style={{ height: "100%", width: "100%" }}
        zoomControl={false}
        dragging
        scrollWheelZoom={false}
        doubleClickZoom={false}
        touchZoom
        boxZoom={false}
        keyboard={false}
      >
        <ZoomControl position="topleft" />
        <TileLayer attribution={MAP_TILE_ATTRIBUTION} url={MAP_TILE_URL} />
        <Marker position={[lat, lng]} icon={icon} title="Venue location" alt="Venue location" />
      </MapContainer>
    </div>
  );
}
