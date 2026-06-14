import { Loader2, MapPin } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/Button/Button";
import type { PublishVenuePreview } from "@fresno-events/shared";

import { AdminLocationMap } from "./AdminLocationMap";
import type { AdminLocationPickerProps } from "./AdminLocationPicker.types";
import styles from "./AdminLocationPicker.module.css";
import { geocodeErrorMessage, useGeocodeVenue } from "./useGeocodeVenue";

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

export function AdminLocationPicker({
  token,
  lat,
  lng,
  address,
  city,
  publishVenuePreview,
  onChange
}: AdminLocationPickerProps) {
  const [error, setError] = useState<string | null>(null);
  const geocodeMutation = useGeocodeVenue(token);

  const latNum = parseCoord(lat);
  const lngNum = parseCoord(lng);
  const hasDraftPin = isMeaningfulPin(latNum, lngNum);
  const hasPreviewPin =
    !hasDraftPin &&
    publishVenuePreview != null &&
    isMeaningfulPin(publishVenuePreview.lat, publishVenuePreview.lng);
  const hasPin = hasDraftPin || hasPreviewPin;
  const pinLat = hasDraftPin ? latNum! : hasPreviewPin ? publishVenuePreview!.lat : null;
  const pinLng = hasDraftPin ? lngNum! : hasPreviewPin ? publishVenuePreview!.lng : null;

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
        {hasDraftPin ? (
          <span className={styles.coords}>
            {lat}, {lng}
          </span>
        ) : hasPreviewPin && pinLat != null && pinLng != null ? (
          <span className={styles.coords}>
            {formatCoord(pinLat)}, {formatCoord(pinLng)}
          </span>
        ) : (
          <span className={styles.coords}>No pin — click map or geocode</span>
        )}
      </div>
      {hasPreviewPin ? (
        <p className={styles.previewHint}>
          Publish preview — pin from existing venue “{publishVenuePreview!.venueName}”. Same location
          after approve. Click the map or geocode to override.
        </p>
      ) : null}
      {!hasPin && address.trim() ? (
        <p className={styles.previewHint}>
          No saved venue pin yet. Approve will geocode from the address if needed.
        </p>
      ) : null}
      {error ? <p className={styles.error}>{error}</p> : null}
      <AdminLocationMap
        lat={lat}
        lng={lng}
        {...(publishVenuePreview ? { publishVenuePreview } : {})}
        onChange={onChange}
      />
    </div>
  );
}
