import type { Event, EventListItem } from "@fresno-events/shared";
import { clampEventPriority } from "@fresno-events/shared";

import { formatEventDate, formatMonthLong, formatShortTime, isTonight, isWeekend, toIsoDateLocal } from "@/lib/event-time";
import { resolveMediaUrl } from "@/lib/media-url";
import { gradientForPalette, paletteKeyForCategory } from "@/lib/image-palette";

export type {
  DayStripTile,
  FeatureCardViewModel,
  FeaturedBadge,
  EventRowViewModel,
  PopularEventViewModel,
  RowPriority
} from "@/lib/event-view-model.types";
import type {
  DayStripTile,
  FeatureCardViewModel,
  FeaturedBadge,
  EventRowViewModel,
  PopularEventViewModel,
  RowPriority
} from "@/lib/event-view-model.types";

const CATEGORY_LABELS: Partial<Record<Event["category"], string>> = {
  music: "Live music",
  comedy: "Comedy",
  food_drink: "Food & drink",
  art: "Arts",
  theater: "Theater",
  sports: "Sports",
  outdoor: "Outdoor",
  family: "Family",
  festival: "Festival",
  community: "Community",
  nightlife: "Nightlife",
  wellness: "Wellness",
  education: "Education"
};

const TAGLINE_FALLBACKS: Partial<Record<Event["category"], string>> = {
  music: "live music",
  food_drink: "food & drink",
  art: "arts & culture",
  sports: "game night",
  family: "family fun",
  outdoor: "outside",
  festival: "festival vibes"
};

export function formatPrice(event: Event): string {
  if (event.isFree || (event.priceMin === 0 && event.priceMax === 0)) {
    return "Free";
  }
  if (typeof event.priceMin === "number" && typeof event.priceMax === "number") {
    return event.priceMin === event.priceMax ? `$${event.priceMin}` : `$${event.priceMin}-${event.priceMax}`;
  }
  if (typeof event.priceMin === "number") {
    return `From $${event.priceMin}`;
  }
  return "Details soon";
}

export function deriveTagline(event: Event): string {
  const text = (event.descriptionText ?? "").trim();
  if (!text) {
    return TAGLINE_FALLBACKS[event.category] ?? "local event";
  }
  const firstSentence = text.split(/[.!?]/)[0]?.trim() ?? text;
  if (firstSentence.length <= 80) {
    return firstSentence;
  }
  return `${firstSentence.slice(0, 77)}…`;
}

export function deriveFeaturedBadge(event: Event, now = new Date()): FeaturedBadge {
  if (event.priority <= 1) return "huge";
  if (isTonight(event.startTs, now)) return "tonight";
  const start = new Date(event.startTs);
  if (isWeekend(start)) return "weekend";
  return "default";
}

export function deriveFlagLabel(event: Event, now = new Date()): string | null {
  if (event.priority === 0) return "PROMOTED";
  if (event.priority === 1) return "HUGE";
  if (isTonight(event.startTs, now)) return "TONIGHT";
  if (event.priority <= 2) return "BIG";
  return null;
}

export function toEventRowViewModel(item: EventListItem, now = new Date()): EventRowViewModel {
  const { event, venue, heroImage } = item;
  const priority = clampEventPriority(event.priority) as RowPriority;
  const paletteKey = paletteKeyForCategory(event.category, event.id);
  const start = new Date(event.startTs);

  return {
    id: event.id,
    slug: event.slug,
    title: event.title,
    tagline: deriveTagline(event),
    venueName: venue.name,
    neighborhood: venue.neighborhood ?? venue.city,
    timeLabel: formatShortTime(event.startTs),
    dateLabel: formatEventDate(event.startTs),
    dayShort: new Intl.DateTimeFormat("en-US", { weekday: "short", timeZone: "America/Los_Angeles" })
      .format(start)
      .toUpperCase()
      .slice(0, 3),
    dayNum: new Intl.DateTimeFormat("en-US", { day: "numeric", timeZone: "America/Los_Angeles" }).format(start),
    monthShort: formatMonthLong(event.startTs),
    categoryLabel: CATEGORY_LABELS[event.category] ?? "Event",
    priceLabel: formatPrice(event),
    flagLabel: deriveFlagLabel(event, now),
    priority,
    paletteKey,
    paletteGradient: gradientForPalette(paletteKey),
    imageUrl: resolveMediaUrl(heroImage?.cdnUrl ?? null),
    isFree: Boolean(event.isFree),
    isLive: false,
    featuredBadge: deriveFeaturedBadge(event, now)
  };
}

export function toFeatureCardViewModel(item: EventListItem, now = new Date()): FeatureCardViewModel {
  const { event, venue, heroImage } = item;
  const paletteKey = paletteKeyForCategory(event.category, event.id);
  const description = (event.descriptionText ?? "").trim();
  const shortDesc = description.length > 120 ? `${description.slice(0, 117)}…` : description;

  return {
    id: event.id,
    slug: event.slug,
    title: event.title,
    description: shortDesc,
    venueName: venue.name,
    timeLabel: formatShortTime(event.startTs),
    priceLabel: formatPrice(event),
    categoryLabel: CATEGORY_LABELS[event.category] ?? "Event",
    badge: deriveFeaturedBadge(event, now),
    paletteKey,
    paletteGradient: gradientForPalette(paletteKey),
    imageUrl: resolveMediaUrl(heroImage?.cdnUrl ?? null),
    isFree: Boolean(event.isFree)
  };
}

export function toPopularViewModels(items: EventListItem[], limit = 5): PopularEventViewModel[] {
  const sorted = [...items].sort((a, b) => {
    if (a.event.priority !== b.event.priority) return a.event.priority - b.event.priority;
    return new Date(a.event.startTs).getTime() - new Date(b.event.startTs).getTime();
  });

  return sorted.slice(0, limit).map((item, index) => ({
    rank: index + 1,
    id: item.event.id,
    slug: item.event.slug,
    title: item.event.title,
    meta: `${item.venue.neighborhood ?? item.venue.city} · ${formatShortTime(item.event.startTs)}`,
    priceLabel: formatPrice(item.event)
  }));
}

export function buildDayStripTiles(anchor: Date, eventCounts: Map<string, number>, days = 14): DayStripTile[] {
  const tiles: DayStripTile[] = [];
  const todayIso = toIsoDateLocal(anchor);

  for (let i = 0; i < days; i++) {
    const date = new Date(anchor);
    date.setDate(anchor.getDate() + i);
    const iso = toIsoDateLocal(date);
    const weekend = isWeekend(date);
    tiles.push({
      isoDate: iso,
      dow: new Intl.DateTimeFormat("en-US", { weekday: "short", timeZone: "America/Los_Angeles" })
        .format(date)
        .toUpperCase(),
      dayNum: new Intl.DateTimeFormat("en-US", { day: "numeric", timeZone: "America/Los_Angeles" }).format(date),
      count: eventCounts.get(iso) ?? 0,
      isToday: iso === todayIso,
      isWeekend: weekend
    });
  }

  return tiles;
}
