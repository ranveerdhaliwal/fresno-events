import type { AdminEventListHit } from "@fresno-events/shared";
import { clampEventPriority } from "@fresno-events/shared";

import type { EventRowViewModel, RowPriority } from "@/lib/event-view-model";
import { formatEventDate, formatMonthLong, formatShortTime } from "@/lib/event-time";
import { gradientForPalette, paletteKeyForCategory } from "@/lib/image-palette";

export interface PublishedPriorityGroup {
  priority: number;
  items: AdminEventListHit[];
}

export function filterPublishedEventsForSearch(
  items: AdminEventListHit[],
  query: string
): AdminEventListHit[] {
  const q = query.trim().toLowerCase();
  if (q.length < 2) {
    return items;
  }

  return items.filter((item) => {
    const blob = `${item.title} ${item.venueName} ${item.source} ${item.slug}`.toLowerCase();
    return blob.includes(q);
  });
}

export function sortPublishedEventsForAdmin(items: AdminEventListHit[]): AdminEventListHit[] {
  return [...items].sort((a, b) => {
    if (a.priority !== b.priority) {
      return a.priority - b.priority;
    }
    return a.startTs.localeCompare(b.startTs);
  });
}

export function groupPublishedEventsByPriority(items: AdminEventListHit[]): PublishedPriorityGroup[] {
  const sorted = sortPublishedEventsForAdmin(items);
  const groups: PublishedPriorityGroup[] = [];

  for (const item of sorted) {
    const last = groups[groups.length - 1];
    if (last && last.priority === item.priority) {
      last.items.push(item);
    } else {
      groups.push({ priority: item.priority, items: [item] });
    }
  }

  return groups;
}

function derivePublishedFlag(priority: number): string | null {
  if (priority === 0) return "PROMOTED";
  if (priority === 1) return "HUGE";
  return "LIVE";
}

export function toPublishedEventRowViewModel(hit: AdminEventListHit): EventRowViewModel {
  const priority = clampEventPriority(hit.priority) as RowPriority;
  const start = new Date(hit.startTs);
  const dayShort = new Intl.DateTimeFormat("en-US", {
    weekday: "short",
    timeZone: "America/Los_Angeles"
  })
    .format(start)
    .toUpperCase()
    .slice(0, 3);

  const dayNum = new Intl.DateTimeFormat("en-US", {
    day: "numeric",
    timeZone: "America/Los_Angeles"
  }).format(start);

  const sourceLabel = hit.source.replace(/^api:/, "").replace(/_/g, " ");

  return {
    id: hit.id,
    slug: hit.slug,
    title: hit.title,
    tagline: sourceLabel,
    venueName: hit.venueName,
    neighborhood: "Fresno",
    timeLabel: formatShortTime(hit.startTs),
    dateLabel: formatEventDate(hit.startTs),
    dayShort,
    dayNum,
    monthShort: formatMonthLong(hit.startTs),
    categoryLabel: sourceLabel,
    priceLabel: hit.status.replace(/_/g, " "),
    flagLabel: derivePublishedFlag(priority),
    priority,
    paletteKey: paletteKeyForCategory("other", hit.id),
    paletteGradient: gradientForPalette(paletteKeyForCategory("other", hit.id)),
    imageUrl: hit.heroImageUrl,
    isFree: false,
    isLive: true,
    featuredBadge: "default"
  };
}
