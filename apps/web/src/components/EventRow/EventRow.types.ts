import type { EventRowViewModel } from "@/lib/event-view-model";

export interface EventRowProps {
  event: EventRowViewModel;
  isSelected?: boolean;
  isLive?: boolean;
  onSelect?: () => void;
  slug?: string;
  showImage?: boolean;
  /** Shown under price (e.g. admin confidence hint). Replaces default RSVP sublabel. */
  priceSubLabel?: string;
  /** Shown above price/confidence (e.g. admin display priority). */
  priorityLabel?: string;
  /** Keep row visible below 600px (admin list). */
  forceVisible?: boolean;
}
