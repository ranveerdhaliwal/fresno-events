import L from "leaflet";
import { useMemo } from "react";
import { Marker, Popup } from "react-leaflet";
import { Link } from "@tanstack/react-router";
import { resolveMapPinEmoji } from "@fresno-events/shared";

import type { VenueEventGroup } from "./EventMap.utils";
import { escapeHtml } from "./EventMapMarkers.utils";

function emojiPinIcon(emoji: string, label: string) {
  const safeLabel = escapeHtml(label);
  return L.divIcon({
    className: "fresno-map-emoji-pin",
    html: `<span class="fresno-map-emoji-pin__dot" role="img" aria-label="${safeLabel}"><span class="fresno-map-emoji-pin__emoji" aria-hidden="true">${emoji}</span></span>`,
    iconSize: [48, 48],
    iconAnchor: [24, 48],
    popupAnchor: [0, -44]
  });
}

function emojiForGroup(group: VenueEventGroup): string {
  const primary = group.events[0];
  if (!primary) {
    return "📍";
  }
  const resolved = resolveMapPinEmoji({
    category: primary.event.category,
    title: primary.event.title,
    tags: primary.event.tags,
    subcategories: primary.event.subcategories,
    ...(primary.event.mapPinEmoji != null ? { mapPinEmoji: primary.event.mapPinEmoji } : {})
  });
  return resolved ?? "📍";
}

export function EventMapMarkers({ groups }: { groups: VenueEventGroup[] }) {
  const icons = useMemo(() => {
    const cache = new Map<string, L.DivIcon>();
    return (group: VenueEventGroup) => {
      const emoji = emojiForGroup(group);
      const cacheKey = `${emoji}|${group.venueName}`;
      const existing = cache.get(cacheKey);
      if (existing) {
        return existing;
      }
      const icon = emojiPinIcon(emoji, `${group.venueName}, ${group.events.length} events`);
      cache.set(cacheKey, icon);
      return icon;
    };
  }, []);

  return (
    <>
      {groups.map((group) => (
        <Marker
          key={group.venueId}
          position={[group.lat, group.lng]}
          icon={icons(group)}
          title={group.venueName}
          alt={group.venueName}
        >
          <Popup>
            <strong>{group.venueName}</strong>
            <ul style={{ margin: "8px 0 0", paddingLeft: 16 }}>
              {group.events.map((item) => (
                <li key={item.event.id}>
                  <Link to="/event/$slug" params={{ slug: item.event.slug }}>
                    {item.event.title}
                  </Link>
                </li>
              ))}
            </ul>
          </Popup>
        </Marker>
      ))}
    </>
  );
}
