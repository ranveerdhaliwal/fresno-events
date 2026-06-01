import type { ImagePaletteKey } from "@/lib/image-palette";

export type FeaturedBadge = "tonight" | "weekend" | "huge" | "default";
export type RowPriority = 0 | 1 | 2 | 3 | 4 | 5;

export interface EventRowViewModel {
  id: string;
  slug: string;
  title: string;
  tagline: string;
  venueName: string;
  neighborhood: string;
  timeLabel: string;
  dateLabel: string;
  dayShort: string;
  dayNum: string;
  categoryLabel: string;
  priceLabel: string;
  flagLabel: string | null;
  priority: RowPriority;
  paletteKey: ImagePaletteKey;
  paletteGradient: string;
  imageUrl: string | null;
  isFree: boolean;
  isLive: boolean;
  featuredBadge: FeaturedBadge;
}

export interface FeatureCardViewModel {
  id: string;
  slug: string;
  title: string;
  description: string;
  venueName: string;
  timeLabel: string;
  priceLabel: string;
  categoryLabel: string;
  badge: FeaturedBadge;
  paletteKey: ImagePaletteKey;
  paletteGradient: string;
  imageUrl: string | null;
  isFree: boolean;
  isPinned?: boolean;
}

export interface PopularEventViewModel {
  rank: number;
  id: string;
  slug: string;
  title: string;
  meta: string;
  priceLabel: string;
  isPinned?: boolean;
}

export interface DayStripTile {
  isoDate: string;
  dow: string;
  dayNum: string;
  count: number;
  isToday: boolean;
  isWeekend: boolean;
}
