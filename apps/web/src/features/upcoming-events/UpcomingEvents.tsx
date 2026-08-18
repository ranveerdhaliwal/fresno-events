import { useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";

import { EmptyState } from "@/components/EmptyState";
import { Button } from "@/components/Button/Button";
import { FilterChip } from "@/components/FilterChip";
import { SectionTitle } from "@/components/SectionTitle";
import { SelectableEventRow } from "@/components/SelectableEventRow";
import { WeekBlockHeader } from "@/components/WeekBlockHeader";
import { ActiveEndedEventList } from "@/features/event-browse/ActiveEndedEventList";
import {
  filterOutPastItems,
  splitTodayItems
} from "@/features/event-browse/active-ended-events.utils";
import { useBrowseEventSelect } from "@/hooks/useIsMobile";
import { calendarSearchCurrent } from "@/lib/calendar-search.utils";
import { toEventRowViewModel } from "@/lib/event-view-model";
import { formatEventDate, formatMonthLong, toIsoDateLocal } from "@/lib/event-time";
import patternStyles from "@/styles/patterns.module.css";
import type { EventSectionBucket } from "@fresno-events/shared";

import { useEventSections } from "./useEventSections";
import { UpcomingDetailPanel } from "./UpcomingDetailPanel";
import { UpcomingEventsSkeleton } from "./UpcomingEventsSkeleton";
import styles from "./UpcomingEvents.module.css";

const FILTERS = ["All", "Today", "This weekend"] as const;
type SectionFilter = (typeof FILTERS)[number];

function sectionDateLabel(bucket: EventSectionBucket, label: string): string {
  if (label === "TODAY") {
    return formatEventDate(new Date(`${bucket.fromIso}T12:00:00-07:00`));
  }
  if (bucket.fromIso === bucket.untilIso) {
    return formatEventDate(new Date(`${bucket.fromIso}T12:00:00-07:00`));
  }
  const from = formatEventDate(new Date(`${bucket.fromIso}T12:00:00-07:00`));
  const until = formatEventDate(new Date(`${bucket.untilIso}T12:00:00-07:00`));
  return `${from} – ${until}`;
}

function SectionBlock({
  label,
  bucket,
  selectedId,
  onSelect,
  dateLabel
}: {
  label: string;
  bucket: EventSectionBucket;
  selectedId: string | null;
  onSelect: (id: string, slug: string) => void;
  dateLabel?: string;
}) {
  const rows = bucket.preview.map((item) => toEventRowViewModel(item));

  return (
    <section className={styles.sectionBlock}>
      <WeekBlockHeader label={label} {...(dateLabel !== undefined ? { dateLabel } : {})} />
      {rows.length === 0 ? (
        <EmptyState>No events scheduled</EmptyState>
      ) : (
        <div className={patternStyles.list}>
          {rows.map((row) => (
            <SelectableEventRow
              key={row.id}
              event={row}
              isSelected={selectedId === row.id}
              isLive={row.isLive}
              onSelect={onSelect}
            />
          ))}
        </div>
      )}
    </section>
  );
}

export function UpcomingEvents() {
  const { data, isLoading } = useEventSections();
  const navigate = useNavigate();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [filter, setFilter] = useState<SectionFilter>("All");
  const todayIso = toIsoDateLocal(new Date());
  const now = useMemo(() => new Date(), []);
  const handleSelect = useBrowseEventSelect({
    onSelectInSplit: setSelectedId,
    onOpenEvent: (slug) => {
      void navigate({ to: "/event/$slug", params: { slug } });
    }
  });

  const weekBucket = useMemo((): EventSectionBucket | null => {
    if (!data) return null;
    const preview = filterOutPastItems(
      data.week.preview.filter((item) => toIsoDateLocal(new Date(item.event.startTs)) !== todayIso),
      now
    );
    const removed = data.week.preview.length - preview.length;
    return {
      ...data.week,
      preview,
      total: Math.max(0, data.week.total - removed),
      hidden: Math.max(0, data.week.hidden)
    };
  }, [data, todayIso, now]);

  const weekendBucket = useMemo((): EventSectionBucket | null => {
    if (!data) return null;
    const preview = filterOutPastItems(data.weekend.preview, now);
    const removed = data.weekend.preview.length - preview.length;
    return {
      ...data.weekend,
      preview,
      total: Math.max(0, data.weekend.total - removed),
      hidden: Math.max(0, data.weekend.hidden)
    };
  }, [data, now]);

  const allRows = useMemo(() => {
    if (!data || !weekBucket || !weekendBucket) return [];
    const { active, ended } = splitTodayItems(data.today.preview, now);
    return [...active, ...ended, ...weekBucket.preview, ...weekendBucket.preview].map((item) =>
      toEventRowViewModel(item, now)
    );
  }, [data, weekBucket, weekendBucket, now]);

  const selected = allRows.find((row) => row.id === selectedId) ?? allRows[0] ?? null;

  const showToday = filter === "All" || filter === "Today";
  const showWeek = filter === "All";
  const showWeekend = filter === "All" || filter === "This weekend";
  const monthLabel = formatMonthLong(new Date());
  const showViewAllCalendar = useMemo(() => {
    if (!data || !weekBucket || !weekendBucket) {
      return false;
    }
    let hidden = 0;
    if (showToday) hidden += data.today.hidden;
    if (showWeek) hidden += weekBucket.hidden;
    if (showWeekend) hidden += weekendBucket.hidden;
    return hidden > 0;
  }, [data, showToday, showWeek, showWeekend, weekBucket, weekendBucket]);

  if (isLoading || !data || !weekBucket || !weekendBucket) {
    return <UpcomingEventsSkeleton />;
  }

  return (
    <div className={styles.wrap} data-testid="upcoming-events">
      <div className={styles.toolbar}>
        <SectionTitle as="h2" script="upcoming" size="sm" scriptJoin="tight">
          EVENTS
        </SectionTitle>
      </div>

      <div className={styles.chips}>
        {FILTERS.map((chip) => (
          <FilterChip key={chip} active={filter === chip} onClick={() => setFilter(chip)}>
            {chip}
          </FilterChip>
        ))}
      </div>

      <div className={patternStyles.browseSplit}>
        <div className={styles.listCol}>
          {showToday ? (
            <section className={styles.sectionBlock}>
              <WeekBlockHeader
                label="TODAY"
                dateLabel={formatEventDate(new Date(`${todayIso}T12:00:00-07:00`))}
              />
              <ActiveEndedEventList
                items={data.today.preview}
                dayIso={todayIso}
                selectedId={selectedId}
                onSelect={handleSelect}
              />
            </section>
          ) : null}
          {showWeek ? (
            <SectionBlock
              label="THIS WEEK"
              bucket={weekBucket}
              selectedId={selectedId}
              onSelect={handleSelect}
              dateLabel={sectionDateLabel(weekBucket, "THIS WEEK")}
            />
          ) : null}
          {showWeekend ? (
            <SectionBlock
              label="THIS WEEKEND"
              bucket={weekendBucket}
              selectedId={selectedId}
              onSelect={handleSelect}
              dateLabel={sectionDateLabel(weekendBucket, "THIS WEEKEND")}
            />
          ) : null}
          {showViewAllCalendar ? (
            <div className={styles.viewAll}>
              <Button
                to="/calendar"
                search={calendarSearchCurrent()}
                variant="mustard"
                size="md"
                className={styles.viewAllBtn}
              >
                View Events all in {monthLabel} →
              </Button>
            </div>
          ) : null}
        </div>
        <div className={patternStyles.detailCol}>
          <UpcomingDetailPanel event={selected} />
        </div>
      </div>
    </div>
  );
}
