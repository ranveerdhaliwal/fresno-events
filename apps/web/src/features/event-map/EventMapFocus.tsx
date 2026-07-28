import { useEffect } from "react";
import { useMap } from "react-leaflet";

export interface EventMapFocusProps {
  lat: number | null;
  lng: number | null;
  zoom?: number;
}

/** Flies the map to the selected event pin when lat/lng change. */
export function EventMapFocus({ lat, lng, zoom = 15 }: EventMapFocusProps) {
  const map = useMap();

  useEffect(() => {
    if (lat == null || lng == null) {
      return;
    }
    map.flyTo([lat, lng], zoom, { duration: 0.65 });
  }, [map, lat, lng, zoom]);

  return null;
}
