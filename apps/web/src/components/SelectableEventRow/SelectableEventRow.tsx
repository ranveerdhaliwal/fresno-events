import type { ReactNode } from "react";

import { EventCard } from "@/components/EventCard";
import { EventRow } from "@/components/EventRow";
import type { EventRowViewModel } from "@/lib/event-view-model";
import patternStyles from "@/styles/patterns.module.css";

export interface SelectableEventRowProps {
  event: EventRowViewModel;
  isSelected?: boolean;
  isLive?: boolean;
  /** When set, the row becomes a select button and a companion EventCard renders for the detail split. */
  onSelect?: (id: string, slug: string) => void;
  /** When true (and no onSelect), the row navigates via an EventRow link instead. */
  linkRows?: boolean;
  adminAction?: ReactNode;
}

/**
 * Pairs an EventRow with its companion EventCard inside the shared
 * `display: contents` row wrapper used by every list + sticky-detail split
 * (EventBrowseSplit, DaySchedule, CalendarPage, UpcomingEvents, ActiveEndedEventList).
 */
export function SelectableEventRow({
  event,
  isSelected,
  isLive,
  onSelect,
  linkRows = false,
  adminAction
}: SelectableEventRowProps) {
  return (
    <div className={patternStyles.rowWrap}>
      <EventRow
        event={event}
        {...(isSelected !== undefined ? { isSelected } : {})}
        {...(isLive !== undefined ? { isLive } : {})}
        {...(onSelect
          ? { onSelect: () => onSelect(event.id, event.slug) }
          : linkRows
            ? { slug: event.slug }
            : {})}
        {...(adminAction ? { adminAction } : {})}
      />
      {onSelect || linkRows ? (
        <EventCard
          event={event}
          {...(onSelect
            ? {
                onSelect,
                ...(isSelected !== undefined ? { isSelected } : {})
              }
            : {})}
        />
      ) : null}
    </div>
  );
}
