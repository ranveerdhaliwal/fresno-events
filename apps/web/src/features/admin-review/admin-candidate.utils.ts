import type { EventCandidate } from "@fresno-events/shared";
import { clampEventPriority } from "@fresno-events/shared";

import type { EventRowViewModel, RowPriority } from "@/lib/event-view-model";

/** Best URL to open the upstream event listing or detail page for manual verification. */
export function resolveCandidateListingUrl(candidate: EventCandidate): string | null {
  const listingUrl =
    candidate.normalizedEvent.externalUrl?.trim() ||
    candidate.detailPageUrl?.trim() ||
    candidate.sourceUrl?.trim();
  return listingUrl || null;
}

export function resolveCandidateTicketUrl(candidate: EventCandidate): string | null {
  const ticketUrl = candidate.normalizedEvent.ticketUrl?.trim();
  if (!ticketUrl) {
    return null;
  }
  const listingUrl = resolveCandidateListingUrl(candidate);
  if (listingUrl && ticketUrl === listingUrl) {
    return null;
  }
  return ticketUrl;
}
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
    timeLabel: candidate.normalizedEvent.timeUnknown ? "" : formatShortTime(candidate.startTs),
    dateLabel: formatEventDate(candidate.startTs),
    dayShort,
    dayNum,
    monthShort: formatMonthLong(candidate.startTs),
    categoryLabel,
    priceLabel: `${scorePct}%`,
    flagLabel: deriveCandidateFlag(priority),
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
    featuredBadge: "default",
    descriptionSnippet: normalized.descriptionText?.slice(0, 120) ?? "",
    venueAddress: candidate.venueName,
    tags: [],
    ticketUrl: null,
    externalUrl: normalized.externalUrl ?? null
  };
}

/** List rows use the priority side-stripe instead of status corner tags. */
function deriveCandidateFlag(priority: RowPriority): string | null {
  if (priority === 0) return "PROMOTED";
  return null;
}
