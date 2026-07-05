import type { ImagePaletteKey } from "@/lib/image-palette";

export type FeaturedBadge = "tonight" | "weekend" | "default";
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
  monthShort: string;
  categoryLabel: string;
  priceLabel: string;
  flagLabel: string | null;
  priority: RowPriority;
  paletteKey: ImagePaletteKey;
  paletteGradient: string;
  imageUrl: string | null;
  /** When set, show logo thumbnail even at community priority in list rows. */
  showVenueLogoInList?: boolean;
  /** Inset (px) around venue logos in list thumbnails. */
  listVenueLogoPadding?: number;
  isFree: boolean;
  isLive: boolean;
  featuredBadge: FeaturedBadge;
  descriptionSnippet: string;
  venueAddress: string;
  tags: string[];
  ticketUrl: string | null;
  externalUrl: string | null;
}

export interface FeatureCardViewModel {
  id: string;
  slug: string;
  title: string;
  description: string;
  venueName: string;
  dateLabel: string;
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
