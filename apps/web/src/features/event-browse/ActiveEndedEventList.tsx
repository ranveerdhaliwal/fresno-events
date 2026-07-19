import type { ReactNode } from "react";
import { useMemo, useState } from "react";

import type { EventListItem } from "@fresno-events/shared";

import { EventCard } from "@/components/EventCard";
import { EventRow } from "@/components/EventRow";
import { Text } from "@/components/Text";
import { cn } from "@/lib/cn";
import { toEventRowViewModel, type EventRowViewModel } from "@/lib/event-view-model";

import {
  filterItemsOnPacificDate,
  partitionEndedPreview,
  splitTodayItems
} from "./active-ended-events.utils";
import styles from "./ActiveEndedEventList.module.css";

export interface ActiveEndedEventListProps {
  items: EventListItem[];
  /** When set, only include this Pacific calendar day. */
  dayIso?: string;
  selectedId?: string | null;
  onSelect?: (id: string, slug: string) => void;
  /** When true (and no onSelect), rows navigate via EventRow links. */
  linkRows?: boolean;
  renderAdminAction?: (eventId: string) => ReactNode;
  emptyMessage?: string;
  className?: string;
  /** Label above ended block when active events are also shown. */
  earlierLabel?: string;
}

function RowList({
  rows,
  selectedId,
  onSelect,
  linkRows,
  renderAdminAction
}: {
  rows: EventRowViewModel[];
  selectedId?: string | null;
  onSelect?: (id: string, slug: string) => void;
  linkRows: boolean;
  renderAdminAction?: (eventId: string) => ReactNode;
}) {
  const selected = rows.find((row) => row.id === selectedId) ?? null;

  return (
    <div className={styles.list}>
      {rows.map((row) => (
        <div key={row.id} className={styles.rowWrap}>
          <EventRow
            event={row}
            isSelected={selected?.id === row.id}
            isLive={row.isLive}
            {...(onSelect
              ? { onSelect: () => onSelect(row.id, row.slug) }
              : linkRows
                ? { slug: row.slug }
                : {})}
            {...(renderAdminAction ? { adminAction: renderAdminAction(row.id) } : {})}
          />
          {onSelect ? <EventCard event={row} /> : null}
        </div>
      ))}
    </div>
  );
}

/**
 * Active (live/upcoming) events first, then a short ended preview with
 * "Show more ended" — shared by homepage Today and event-detail same-day.
 */
export function ActiveEndedEventList({
  items,
  dayIso,
  selectedId = null,
  onSelect,
  linkRows = false,
  renderAdminAction,
  emptyMessage = "No events scheduled",
  className,
  earlierLabel = "Earlier today"
}: ActiveEndedEventListProps) {
  const [showAllEnded, setShowAllEnded] = useState(false);
  const now = useMemo(() => new Date(), []);

  const { activeRows, endedPreviewRows, endedRestRows } = useMemo(() => {
    const scoped = dayIso ? filterItemsOnPacificDate(items, dayIso) : items;
    const { active, ended } = splitTodayItems(scoped, now);
    const { preview, rest } = partitionEndedPreview(ended);
    return {
      activeRows: active.map((item) => toEventRowViewModel(item, now)),
      endedPreviewRows: preview.map((item) => toEventRowViewModel(item, now)),
      endedRestRows: rest.map((item) => toEventRowViewModel(item, now))
    };
  }, [items, dayIso, now]);

  const visibleEnded = showAllEnded ? [...endedPreviewRows, ...endedRestRows] : endedPreviewRows;
  const hasRows = activeRows.length > 0 || visibleEnded.length > 0;
  const hiddenEndedCount = endedRestRows.length;

  if (!hasRows) {
    return (
      <Text variant="body2" tone="mutedOnCard" className={cn(styles.empty, className)} data-testid="active-ended-empty">
        {emptyMessage}
      </Text>
    );
  }

  return (
    <div className={cn(styles.wrap, className)} data-testid="active-ended-event-list">
      {activeRows.length > 0 ? (
        <RowList
          rows={activeRows}
          selectedId={selectedId}
          {...(onSelect ? { onSelect } : {})}
          linkRows={linkRows}
          {...(renderAdminAction ? { renderAdminAction } : {})}
        />
      ) : null}
      {visibleEnded.length > 0 ? (
        <div className={styles.endedBlock}>
          {activeRows.length > 0 ? (
            <Text variant="body3" tone="mutedOnPage" as="p" className={styles.endedLabel}>
              {earlierLabel}
            </Text>
          ) : null}
          <RowList
            rows={visibleEnded}
            selectedId={selectedId}
            {...(onSelect ? { onSelect } : {})}
            linkRows={linkRows}
            {...(renderAdminAction ? { renderAdminAction } : {})}
          />
        </div>
      ) : null}
      {!showAllEnded && hiddenEndedCount > 0 ? (
        <button
          type="button"
          className={styles.showMoreEnded}
          onClick={() => setShowAllEnded(true)}
          data-testid="show-more-ended"
        >
          <Text variant="eyebrow" tone="inherit" as="span">
            SHOW MORE ENDED ({hiddenEndedCount}) ↓
          </Text>
        </button>
      ) : null}
    </div>
  );
}
