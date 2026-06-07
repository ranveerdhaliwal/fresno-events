import type { EventCandidate } from "@fresno-events/shared";
import { clampEventPriority } from "@fresno-events/shared";

import type { EventRowViewModel, RowPriority } from "@/lib/event-view-model";
import { formatEventDate, formatMonthLong, formatShortTime } from "@/lib/event-time";
import { gradientForPalette, paletteKeyForCategory } from "@/lib/image-palette";

export function toCandidateEventRowViewModel(
  candidate: EventCandidate,
  displayPriority: number,
  options: { showStatusInLabel?: boolean } = {}
): EventRowViewModel {
  const priority = clampEventPriority(displayPriority) as RowPriority;
  const normalized = candidate.normalizedEvent;
  const category = normalized.category ?? "other";
  const paletteKey = paletteKeyForCategory(category, candidate.id);
  const start = new Date(candidate.startTs);
  const scorePct = Math.round(candidate.confidenceScore * 100);

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

  const sourceLabel = candidate.source.replace(/^api:/, "").replace(/_/g, " ");
  const statusLabel = candidate.status.replace(/_/g, " ");
  const categoryLabel = options.showStatusInLabel
    ? `${statusLabel} · ${sourceLabel}`
    : sourceLabel;
  return {
    id: candidate.id,
    slug: candidate.id,
    title: candidate.title,
    tagline: normalized.descriptionText?.slice(0, 80) ?? sourceLabel,
    venueName: candidate.venueName,
    neighborhood: normalized.venueCity ?? "Fresno",
    timeLabel: formatShortTime(candidate.startTs),
    dateLabel: formatEventDate(candidate.startTs),
    dayShort,
    dayNum,
    monthShort: formatMonthLong(candidate.startTs),
    categoryLabel,
    priceLabel: `${scorePct}%`,
    flagLabel: deriveCandidateFlag(priority, candidate.status),
    priority,
    paletteKey,
    paletteGradient: gradientForPalette(paletteKey),
    imageUrl: normalized.imageUrl ?? null,
    ...(normalized.showVenueLogoInList ? { showVenueLogoInList: true } : {}),
    ...(normalized.listVenueLogoPadding !== undefined
      ? { listVenueLogoPadding: normalized.listVenueLogoPadding }
      : {}),
    isFree: false,
    isLive: false,
    featuredBadge: "default"
  };
}

function deriveCandidateFlag(
  priority: RowPriority,
  status: EventCandidate["status"]
): string | null {
  if (priority === 0) return "PROMOTED";
  if (priority === 1) return "HUGE";
  if (status === "pending_review") return "REVIEW";
  if (status === "needs_changes") return "UPDATE";
  return status.replace(/_/g, " ").toUpperCase();
}
