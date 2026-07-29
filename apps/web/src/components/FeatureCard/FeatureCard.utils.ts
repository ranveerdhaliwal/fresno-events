import type { FeaturedBadge } from "@/lib/event-view-model.types";

export function shouldShowFeaturedBadge(_badge: FeaturedBadge): boolean {
  // Home feature cards no longer show tonight/weekend overlays.
  return false;
}

export function formatFeaturedBadgeLabel(badge: FeaturedBadge): string {
  return badge.toUpperCase();
}
