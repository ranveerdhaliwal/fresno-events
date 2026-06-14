import type { MapPinEmojiInput } from "@fresno-events/shared";

export interface VenueMiniMapProps extends MapPinEmojiInput {
  lat: number;
  lng: number;
  height?: number;
}
