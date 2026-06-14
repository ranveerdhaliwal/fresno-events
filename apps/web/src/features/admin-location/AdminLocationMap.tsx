import { memo, useEffect, useMemo } from "react";
import { MapContainer, Marker, TileLayer, useMap, useMapEvents } from "react-leaflet";

import { FRESNO_CENTER, MAP_TILE_ATTRIBUTION, MAP_TILE_URL } from "@/lib/map-config";
import type { PublishVenuePreview } from "@fresno-events/shared";

import styles from "./AdminLocationPicker.module.css";

function parseCoord(value: string): number | null {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function formatCoord(value: number): string {
  return value.toFixed(5);
}

function isMeaningfulPin(lat: number | null, lng: number | null): boolean {
  if (lat == null || lng == null) {
    return false;
  }
  return !(lat === 0 && lng === 0);
}

function MapRecenter({ center, zoom }: { center: { lat: number; lng: number }; zoom: number }) {
  const map = useMap();
  useEffect(() => {
    map.setView([center.lat, center.lng], zoom, { animate: false });
  }, [map, center.lat, center.lng, zoom]);
  return null;
}

function MapClickHandler({ onPick }: { onPick: (lat: number, lng: number) => void }) {
  useMapEvents({
    click(event) {
      onPick(event.latlng.lat, event.latlng.lng);
    }
  });
  return null;
}

export interface AdminLocationMapProps {
  lat: string;
  lng: string;
  publishVenuePreview?: PublishVenuePreview;
  onChange: (coords: { lat: string; lng: string }) => void;
}

/** Leaflet map isolated from address/city typing — only re-renders when pin coords change. */
export const AdminLocationMap = memo(function AdminLocationMap({
  lat,
  lng,
  publishVenuePreview,
  onChange
}: AdminLocationMapProps) {
  const latNum = parseCoord(lat);
  const lngNum = parseCoord(lng);
  const hasDraftPin = isMeaningfulPin(latNum, lngNum);
  const hasPreviewPin =
    !hasDraftPin &&
    publishVenuePreview != null &&
    isMeaningfulPin(publishVenuePreview.lat, publishVenuePreview.lng);
  const hasPin = hasDraftPin || hasPreviewPin;
  const pinLat = hasDraftPin ? latNum! : hasPreviewPin ? publishVenuePreview!.lat : FRESNO_CENTER.lat;
  const pinLng = hasDraftPin ? lngNum! : hasPreviewPin ? publishVenuePreview!.lng : FRESNO_CENTER.lng;
  const center = { lat: pinLat, lng: pinLng };
  const markerKey = useMemo(() => `${lat}-${lng}`, [lat, lng]);

  const handlePick = (nextLat: number, nextLng: number) => {
    onChange({ lat: formatCoord(nextLat), lng: formatCoord(nextLng) });
  };

  return (
    <div className={styles.map}>
      <MapContainer
        center={[center.lat, center.lng]}
        zoom={hasPin ? 16 : 13}
        style={{ height: "100%", width: "100%" }}
        scrollWheelZoom={false}
        doubleClickZoom={false}
        touchZoom={false}
        boxZoom={false}
      >
        <TileLayer attribution={MAP_TILE_ATTRIBUTION} url={MAP_TILE_URL} />
        <MapRecenter center={center} zoom={hasPin ? 16 : 13} />
        <MapClickHandler onPick={handlePick} />
        {hasPin ? (
          <Marker
            key={hasDraftPin ? markerKey : `preview-${pinLat}-${pinLng}`}
            position={[pinLat, pinLng]}
            draggable={hasDraftPin || hasPreviewPin}
            eventHandlers={{
              dragend: (event) => {
                const marker = event.target;
                handlePick(marker.getLatLng().lat, marker.getLatLng().lng);
              }
            }}
          />
        ) : null}
      </MapContainer>
    </div>
  );
});
