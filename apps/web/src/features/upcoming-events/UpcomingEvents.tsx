import { Link, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";

import { EventCard } from "@/components/EventCard";
import { EventRow } from "@/components/EventRow";
import { FilterChip } from "@/components/FilterChip";
import { SectionTitle } from "@/components/SectionTitle";
import { Text } from "@/components/Text";
import { WeekBlockHeader } from "@/components/WeekBlockHeader";
import { ActiveEndedEventList } from "@/features/event-browse/ActiveEndedEventList";
import {
  filterOutPastItems,
  splitTodayItems
} from "@/features/event-browse/active-ended-events.utils";
import { useBrowseEventSelect } from "@/hooks/useIsMobile";
import { calendarSearchCurrent } from "@/lib/calendar-search.utils";
import { toEventRowViewModel } from "@/lib/event-view-model";
import { formatEventDate, toIsoDateLocal } from "@/lib/event-time";
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
        <Text variant="body2" tone="mutedOnCard" className={styles.empty}>
          No events scheduled
        </Text>
      ) : (
        <div className={styles.list}>
          {rows.map((row) => (
            <div key={row.id} className={styles.rowWrap}>
              <EventRow
                event={row}
                isSelected={selectedId === row.id}
                isLive={row.isLive}
                onSelect={() => onSelect(row.id, row.slug)}
              />
              <EventCard event={row} />
            </div>
          ))}
        </div>
      )}
      {bucket.hidden > 0 ? (
        <Link to="/calendar" search={calendarSearchCurrent()} className={styles.viewAll}>
          {bucket.hidden} more events · View all →
        </Link>
      ) : null}
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

  if (isLoading || !data || !weekBucket || !weekendBucket) {
    return <UpcomingEventsSkeleton />;
  }

  return (
    <div className={styles.wrap} data-testid="upcoming-events">
      <div className={styles.toolbar}>
        <SectionTitle as="h2" script="upcoming" size="sm">
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

      <div className={styles.split}>
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
        </div>
        <div className={styles.detailCol}>
          <UpcomingDetailPanel event={selected} />
        </div>
      </div>
    </div>
  );
}
