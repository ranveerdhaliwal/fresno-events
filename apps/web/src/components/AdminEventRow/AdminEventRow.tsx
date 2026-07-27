import type { ReactNode } from "react";

import { EventRow } from "@/components/EventRow";
import type { EventRowViewModel } from "@/lib/event-view-model";

export interface AdminEventRowProps {
  event: EventRowViewModel;
  isSelected?: boolean;
  onSelect?: () => void;
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

/**
 * Admin-only view of EventRow — narrows the shared component to the props
 * CandidateList and PublishedEventList actually use, keeping priorityLabel,
 * priceSubLabel, forceVisible, and showP5ListImage out of the public API.
 */
export function AdminEventRow({
  event,
  isSelected,
  onSelect,
  showImage,
  showP5ListImage,
  priceSubLabel,
  priorityLabel,
  forceVisible,
  adminAction
}: AdminEventRowProps) {
  return (
    <EventRow
      event={event}
      {...(isSelected !== undefined ? { isSelected } : {})}
      {...(onSelect ? { onSelect } : {})}
      {...(showImage !== undefined ? { showImage } : {})}
      {...(showP5ListImage !== undefined ? { showP5ListImage } : {})}
      {...(priceSubLabel !== undefined ? { priceSubLabel } : {})}
      {...(priorityLabel !== undefined ? { priorityLabel } : {})}
      {...(forceVisible !== undefined ? { forceVisible } : {})}
      {...(adminAction ? { adminAction } : {})}
    />
  );
}
