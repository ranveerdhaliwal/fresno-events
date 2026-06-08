import type { EventListItem } from "@fresno-events/shared";

import type { DatePreset } from "@/lib/date-presets";
import { resolveDatePreset } from "@/lib/date-presets";
import { withinRadius } from "@/lib/geo.utils";
import { FRESNO_CENTER } from "@/lib/map-config";

export interface VenueEventGroup {
  venueId: string;
  venueName: string;
  lat: number;
  lng: number;
  events: EventListItem[];
  category: EventListItem["event"]["category"];
}

export function groupEventsByVenue(items: EventListItem[]): VenueEventGroup[] {
  const byVenue = new Map<string, VenueEventGroup>();

  for (const item of items) {
    const { venue, event } = item;
    if (venue.lat == null || venue.lng == null) {
      continue;
    }

    const existing = byVenue.get(venue.id);
    if (existing) {
      existing.events.push(item);
      continue;
    }

    byVenue.set(venue.id, {
      venueId: venue.id,
      venueName: venue.name,
      lat: venue.lat,
      lng: venue.lng,
      events: [item],
      category: event.category
    });
  }

  return [...byVenue.values()];
}

export function filterEventsForMap(
  items: EventListItem[],
  options: {
    q?: string;
    datePreset?: DatePreset | null;
    nearMe?: { lat: number; lng: number; radiusKm: number } | null;
  }
): EventListItem[] {
  let filtered = items;

  if (options.datePreset) {
    const range = resolveDatePreset(options.datePreset);
    filtered = filtered.filter((item) => {
      const start = new Date(item.event.startTs).getTime();
      return start >= range.from.getTime() && start <= range.until.getTime();
    });
  }

  if (options.q?.trim()) {
    const needle = options.q.trim().toLowerCase();
    filtered = filtered.filter(
      (item) =>
        item.event.title.toLowerCase().includes(needle) ||
        item.venue.name.toLowerCase().includes(needle)
    );
  }

  if (options.nearMe) {
    const { lat, lng, radiusKm } = options.nearMe;
    filtered = filtered.filter((item) => {
      const vLat = item.venue.lat;
      const vLng = item.venue.lng;
      if (vLat == null || vLng == null) {
        return false;
      }
      return withinRadius(vLat, vLng, lat, lng, radiusKm);
    });
  }

  return filtered;
}

export function defaultNearMeCenter() {
  return FRESNO_CENTER;
}
