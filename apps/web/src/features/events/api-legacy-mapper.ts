import type { Event, EventListItem } from "@fresno-events/shared";

import { formatPrice } from "@/lib/event-view-model";
import { formatEventDate, formatShortTime } from "@/lib/event-time";

import type { EventAccent, TodayEventItem } from "./types";

const accents: EventAccent[] = ["sunset", "fig", "sky", "olive", "rose"];

/** Maps API list items to legacy TodayEventItem for unmigrated pages. */
export function toTodayEventItem(item: EventListItem, index: number): TodayEventItem {
  const accent = accents[index % accents.length] ?? "sunset";
  const base = {
    event: item.event,
    venue: item.venue,
    accent,
    kicker: getKicker(item.event, index),
    neighborhood: item.venue.neighborhood ?? item.venue.city,
    priceLabel: formatPrice(item.event),
    timeLabel: formatShortTime(item.event.startTs),
    dateLabel: formatEventDate(item.event.startTs),
    saveCount: estimateSaveCount(item.event.id),
    ...(item.event.priority <= 1 ? { featured: true as const } : {})
  };

  return item.heroImage ? { ...base, heroImage: item.heroImage } : base;
}

function getKicker(event: Event, index: number) {
  if (event.priority === 0) return "Sponsored";
  if (event.priority === 1) return "Start here";
  if (event.priority <= 2) return "Tonight";
  const labels: Partial<Record<Event["category"], string>> = {
    family: "Family-friendly",
    music: "Live music",
    sports: "Game night",
    food_drink: "Food & drink",
    art: "Arts pick",
    theater: "On stage",
    festival: "Festival watch",
    outdoor: "Outside"
  };
  return labels[event.category] ?? `Local pick ${index + 1}`;
}

function estimateSaveCount(id: string) {
  const seed = [...id].reduce((total, char) => total + char.charCodeAt(0), 0);
  return 90 + (seed % 280);
}
