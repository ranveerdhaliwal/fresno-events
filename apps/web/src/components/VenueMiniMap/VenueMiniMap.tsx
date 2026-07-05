import L from "leaflet";
import { useMemo } from "react";
import { MapContainer, Marker, TileLayer } from "react-leaflet";

import { resolveMapPinEmoji } from "@fresno-events/shared";
import { MAP_TILE_ATTRIBUTION, MAP_TILE_URL } from "@/lib/map-config";

import type { VenueMiniMapProps } from "./VenueMiniMap.types";
import { buildEmojiMarkerHtml } from "./VenueMiniMap.utils";
import styles from "./VenueMiniMap.module.css";

import markerIcon2x from "leaflet/dist/images/marker-icon-2x.png";
import markerIcon from "leaflet/dist/images/marker-icon.png";
import markerShadow from "leaflet/dist/images/marker-shadow.png";

export function VenueMiniMap({
  lat,
  lng,
  height = 200,
  category,
  title,
  tags,
  subcategories,
  mapPinEmoji
}: VenueMiniMapProps) {
  const icon = useMemo(() => {
    const emoji = resolveMapPinEmoji({
      ...(category !== undefined ? { category } : {}),
      ...(title !== undefined ? { title } : {}),
      ...(tags !== undefined ? { tags } : {}),
      ...(subcategories !== undefined ? { subcategories } : {}),
      ...(mapPinEmoji !== undefined ? { mapPinEmoji } : {})
    });
    if (!emoji) {
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
    return L.divIcon({
      className: "",
      html: buildEmojiMarkerHtml(emoji),
      iconSize: [32, 32],
      iconAnchor: [16, 32]
    });
  }, [category, title, tags, subcategories, mapPinEmoji]);

  return (
    <div className={styles.map} style={{ height }}>
      <MapContainer
        center={[lat, lng]}
        zoom={14}
        style={{ height: "100%", width: "100%" }}
        zoomControl={false}
        dragging={false}
        scrollWheelZoom={false}
        doubleClickZoom={false}
        touchZoom={false}
        boxZoom={false}
        keyboard={false}
      >
        <TileLayer attribution={MAP_TILE_ATTRIBUTION} url={MAP_TILE_URL} />
        <Marker position={[lat, lng]} icon={icon} />
      </MapContainer>
    </div>
  );
}
