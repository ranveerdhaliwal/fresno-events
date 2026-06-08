import L from "leaflet";
import { useMemo } from "react";
import { Marker, Popup } from "react-leaflet";
import { Link } from "@tanstack/react-router";

import { getCategoryEmoji } from "@/lib/category-icons";

import type { VenueEventGroup } from "./EventMap.utils";

function emojiIcon(emoji: string) {
  return L.divIcon({
    className: "",
    html: `<span style="display:flex;align-items:center;justify-content:center;width:30px;height:30px;font-size:20px;line-height:1;filter:drop-shadow(0 2px 2px rgba(0,0,0,0.25))">${emoji}</span>`,
    iconSize: [30, 30],
    iconAnchor: [15, 30]
  });
}

export function EventMapMarkers({ groups }: { groups: VenueEventGroup[] }) {
  const icons = useMemo(() => {
    const cache = new Map<string, L.DivIcon>();
    return (category: VenueEventGroup["category"]) => {
      const key = category;
      const existing = cache.get(key);
      if (existing) {
        return existing;
      }
      const icon = emojiIcon(getCategoryEmoji(category));
      cache.set(key, icon);
      return icon;
    };
  }, []);

  return (
    <>
      {groups.map((group) => (
        <Marker key={group.venueId} position={[group.lat, group.lng]} icon={icons(group.category)}>
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
