import type { ReactNode } from "react";

import type { EventRowViewModel } from "@/lib/event-view-model";

export interface EventRowProps {
  event: EventRowViewModel;
  isSelected?: boolean;
  isLive?: boolean;
  onSelect?: () => void;
  slug?: string;
  showImage?: boolean;
  /** Admin review: show P5 row thumbnails (time · image · date · title). */
  showP5ListImage?: boolean;
  /** Shown under price (e.g. admin confidence hint). */
  priceSubLabel?: string;
  /** Shown above price/confidence (e.g. admin display priority). */
  priorityLabel?: string;
  /** Keep row visible below 600px (admin list). */
  forceVisible?: boolean;
  /** Optional admin action element (e.g. edit link) rendered in the price area. */
  adminAction?: ReactNode;
}
