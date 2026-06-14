import type { PublishVenuePreview } from "@fresno-events/shared";

export interface AdminLocationPickerProps {
  token: string;
  lat: string;
  lng: string;
  address: string;
  city: string;
  /** Pin from venues table — matches what approve will use when candidate coords are empty. */
  publishVenuePreview?: PublishVenuePreview;
  onChange: (coords: { lat: string; lng: string }) => void;
}
