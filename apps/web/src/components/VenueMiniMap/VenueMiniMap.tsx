import L from "leaflet";
import { useMemo } from "react";
import { MapContainer, Marker, TileLayer } from "react-leaflet";
import "leaflet/dist/leaflet.css";

import { getCategoryEmoji } from "@/lib/category-icons";
import { MAP_TILE_ATTRIBUTION, MAP_TILE_URL } from "@/lib/map-config";

import type { VenueMiniMapProps } from "./VenueMiniMap.types";
import styles from "./VenueMiniMap.module.css";

export function VenueMiniMap({ lat, lng, category, height = 200 }: VenueMiniMapProps) {
  const icon = useMemo(() => {
    const emoji = getCategoryEmoji(category);
    return L.divIcon({
      className: "",
      html: `<span style="display:flex;align-items:center;justify-content:center;width:32px;height:32px;font-size:22px;line-height:1;filter:drop-shadow(0 2px 2px rgba(0,0,0,0.25))">${emoji}</span>`,
      iconSize: [32, 32],
      iconAnchor: [16, 32]
    });
  }, [category]);

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
