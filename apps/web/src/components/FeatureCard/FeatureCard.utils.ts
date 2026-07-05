import type { FeaturedBadge } from "@/lib/event-view-model.types";

export function shouldShowFeaturedBadge(badge: FeaturedBadge): boolean {
  return badge !== "default";
}

export function formatFeaturedBadgeLabel(badge: FeaturedBadge): string {
  return badge.toUpperCase();
}
