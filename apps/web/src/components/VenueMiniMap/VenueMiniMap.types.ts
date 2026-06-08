import type { EventCategory } from "@fresno-events/shared";

export interface VenueMiniMapProps {
  lat: number;
  lng: number;
  category?: EventCategory;
  height?: number;
}
