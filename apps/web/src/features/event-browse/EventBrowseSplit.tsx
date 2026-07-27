import type { ReactNode } from "react";

import { SelectableEventRow } from "@/components/SelectableEventRow";
import { UpcomingDetailPanel } from "@/features/upcoming-events/UpcomingDetailPanel";
import type { EventRowViewModel } from "@/lib/event-view-model";
import { cn } from "@/lib/cn";
import patternStyles from "@/styles/patterns.module.css";

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
    <div className={cn(patternStyles.browseSplit, className)} data-testid="event-browse-split">
      <div className={styles.listCol}>
        {listHeader}
        {rows.length === 0 ? (
          empty
        ) : (
          <div className={patternStyles.list}>
            {rows.map((row) => (
              <SelectableEventRow
                key={row.id}
                event={row}
                isSelected={selected?.id === row.id}
                isLive={row.isLive}
                onSelect={onSelect}
              />
            ))}
          </div>
        )}
        {listFooter}
      </div>
      <div className={patternStyles.detailCol}>
        <UpcomingDetailPanel event={selected} />
      </div>
    </div>
  );
}
