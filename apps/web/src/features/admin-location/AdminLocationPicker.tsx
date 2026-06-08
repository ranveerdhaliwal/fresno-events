import L from "leaflet";
import { Loader2, MapPin } from "lucide-react";
import { useMemo, useState } from "react";
import { MapContainer, Marker, TileLayer, useMapEvents } from "react-leaflet";
import "leaflet/dist/leaflet.css";

import { Button } from "@/components/Button/Button";
import { FRESNO_CENTER, MAP_TILE_ATTRIBUTION, MAP_TILE_URL } from "@/lib/map-config";

import type { AdminLocationPickerProps } from "./AdminLocationPicker.types";
import styles from "./AdminLocationPicker.module.css";
import { geocodeErrorMessage, useGeocodeVenue } from "./useGeocodeVenue";

import markerIcon2x from "leaflet/dist/images/marker-icon-2x.png";
import markerIcon from "leaflet/dist/images/marker-icon.png";
import markerShadow from "leaflet/dist/images/marker-shadow.png";

// Vite needs explicit default marker assets.
// eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-member-access
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: markerIcon2x,
  iconUrl: markerIcon,
  shadowUrl: markerShadow
});

function parseCoord(value: string): number | null {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function formatCoord(value: number): string {
  return value.toFixed(5);
}

function MapClickHandler({ onPick }: { onPick: (lat: number, lng: number) => void }) {
  useMapEvents({
    click(event) {
      onPick(event.latlng.lat, event.latlng.lng);
    }
  });
  return null;
}

export function AdminLocationPicker({
  token,
  lat,
  lng,
  address,
  city,
  onChange
}: AdminLocationPickerProps) {
  const [error, setError] = useState<string | null>(null);
  const geocodeMutation = useGeocodeVenue(token);

  const latNum = parseCoord(lat);
  const lngNum = parseCoord(lng);
  const hasPin = latNum != null && lngNum != null;
  const center = hasPin ? { lat: latNum, lng: lngNum } : FRESNO_CENTER;

  const markerKey = useMemo(() => `${lat}-${lng}`, [lat, lng]);

  const handlePick = (nextLat: number, nextLng: number) => {
    setError(null);
    onChange({ lat: formatCoord(nextLat), lng: formatCoord(nextLng) });
  };

  const handleGeocode = () => {
    setError(null);
    geocodeMutation.mutate(
      { address, city },
      {
        onSuccess: (result) => {
          onChange({ lat: formatCoord(result.lat), lng: formatCoord(result.lng) });
        },
        onError: (mutationError) => {
          setError(geocodeErrorMessage(mutationError));
        }
      }
    );
  };

  return (
    <div className={styles.root}>
      <div className={styles.toolbar}>
        <Button
          variant="secondary"
          size="sm"
          disabled={geocodeMutation.isPending || !address.trim()}
          onClick={handleGeocode}
        >
          {geocodeMutation.isPending ? (
            <Loader2 className="size-3.5 animate-spin" aria-hidden />
          ) : (
            <MapPin className="size-3.5" aria-hidden />
          )}
          Geocode from address
        </Button>
        {hasPin ? (
          <span className={styles.coords}>
            {lat}, {lng}
          </span>
        ) : (
          <span className={styles.coords}>No pin — click map or geocode</span>
        )}
      </div>
      {error ? <p className={styles.error}>{error}</p> : null}
      <div className={styles.map}>
        <MapContainer
          center={[center.lat, center.lng]}
          zoom={hasPin ? 14 : 11}
          style={{ height: "100%", width: "100%" }}
        >
          <TileLayer attribution={MAP_TILE_ATTRIBUTION} url={MAP_TILE_URL} />
          <MapClickHandler onPick={handlePick} />
          {hasPin ? (
            <Marker
              key={markerKey}
              position={[latNum, lngNum]}
              draggable
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
    </div>
  );
}
