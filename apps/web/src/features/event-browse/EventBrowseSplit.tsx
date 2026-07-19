import type { ReactNode } from "react";

import { EventCard } from "@/components/EventCard";
import { EventRow } from "@/components/EventRow";
import { UpcomingDetailPanel } from "@/features/upcoming-events/UpcomingDetailPanel";
import type { EventRowViewModel } from "@/lib/event-view-model";
import { cn } from "@/lib/cn";

import styles from "./EventBrowseSplit.module.css";

export interface EventBrowseSplitProps {
  rows: EventRowViewModel[];
  selected: EventRowViewModel | null;
  onSelect: (id: string, slug: string) => void;
  listHeader?: ReactNode;
  empty?: ReactNode;
  className?: string;
  /** Extra content under the event list (e.g. venues on search). */
  listFooter?: ReactNode;
}

export function EventBrowseSplit({
  rows,
  selected,
  onSelect,
  listHeader,
  empty,
  className,
  listFooter
}: EventBrowseSplitProps) {
  return (
    <div className={cn(styles.split, className)} data-testid="event-browse-split">
      <div className={styles.listCol}>
        {listHeader}
        {rows.length === 0 ? (
          empty
        ) : (
          <div className={styles.list}>
            {rows.map((row) => (
              <div key={row.id} className={styles.rowWrap}>
                <EventRow
                  event={row}
                  isSelected={selected?.id === row.id}
                  isLive={row.isLive}
                  onSelect={() => onSelect(row.id, row.slug)}
                />
                <EventCard event={row} />
              </div>
            ))}
          </div>
        )}
        {listFooter}
      </div>
      <div className={styles.detailCol}>
        <UpcomingDetailPanel event={selected} />
      </div>
    </div>
  );
}
