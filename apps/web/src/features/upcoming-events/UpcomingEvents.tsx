import { Link, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";

import { EventCard } from "@/components/EventCard";
import { EventRow } from "@/components/EventRow";
import { WeekBlockHeader } from "@/components/WeekBlockHeader";
import { calendarSearchCurrent } from "@/lib/calendar-search.utils";
import { toEventRowViewModel } from "@/lib/event-view-model";
import { toIsoDateLocal } from "@/lib/event-time";
import type { EventSectionBucket } from "@fresno-events/shared";

import { useEventSections } from "./useEventSections";
import { UpcomingDetailPanel } from "./UpcomingDetailPanel";
import styles from "./UpcomingEvents.module.css";

const FILTERS = ["All", "Today", "This weekend"] as const;
type SectionFilter = (typeof FILTERS)[number];

function SectionBlock({
  label,
  bucket,
  selectedId,
  onSelect
}: {
  label: string;
  bucket: EventSectionBucket;
  selectedId: string | null;
  onSelect: (id: string, slug: string) => void;
}) {
  const rows = bucket.preview.map((item) => toEventRowViewModel(item));
  const selected = rows.find((row) => row.id === selectedId) ?? rows[0] ?? null;

  return (
    <section className={styles.sectionBlock}>
      <WeekBlockHeader label={label} dateRange={`${bucket.fromIso} – ${bucket.untilIso}`} />
      {rows.length === 0 ? (
        <p className={styles.empty}>No events yet</p>
      ) : (
        <div className={styles.list}>
          {rows.map((row) => (
            <div key={row.id} className={styles.rowWrap}>
              <EventRow event={row} isSelected={selected?.id === row.id} onSelect={() => onSelect(row.id, row.slug)} />
              <EventCard event={row} />
            </div>
          ))}
        </div>
      )}
      {bucket.hidden > 0 ? (
        label === "TODAY" ? (
          <Link to="/day/$date" params={{ date: bucket.fromIso }} className={styles.viewAll}>
            {bucket.hidden} more events · View all →
          </Link>
        ) : (
          <Link to="/calendar" search={calendarSearchCurrent()} className={styles.viewAll}>
            {bucket.hidden} more events · View all →
          </Link>
        )
      ) : null}
    </section>
  );
}

function isMobileViewport() {
  return typeof window !== "undefined" && window.matchMedia("(max-width: 600px)").matches;
}

export function UpcomingEvents() {
  const { data, isLoading } = useEventSections();
  const navigate = useNavigate();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [filter, setFilter] = useState<SectionFilter>("All");
  const todayIso = toIsoDateLocal(new Date());

  const allRows = useMemo(() => {
    if (!data) return [];
    return [...data.today.preview, ...data.week.preview, ...data.weekend.preview].map((item) =>
      toEventRowViewModel(item)
    );
  }, [data]);

  const selected = allRows.find((row) => row.id === selectedId) ?? allRows[0] ?? null;

  const handleSelect = (id: string, slug: string) => {
    if (isMobileViewport()) {
      void navigate({ to: "/event/$slug", params: { slug } });
      return;
    }
    setSelectedId(id);
  };

  const showToday = filter === "All" || filter === "Today";
  const showWeek = filter === "All";
  const showWeekend = filter === "All" || filter === "This weekend";

  if (isLoading || !data) {
    return <div className={styles.loading}>Loading upcoming events…</div>;
  }

  return (
    <div className={styles.wrap} data-testid="upcoming-events">
      <div className={styles.toolbar}>
        <h2>
          <span className={styles.script}>upcoming</span> EVENTS
        </h2>
      </div>

      <div className={styles.chips}>
        {FILTERS.map((chip) => (
          <button
            key={chip}
            type="button"
            className={filter === chip ? styles.chipActive : styles.chip}
            onClick={() => setFilter(chip)}
          >
            {chip}
          </button>
        ))}
      </div>

      <div className={styles.split}>
        <div className={styles.listCol}>
          {showToday ? (
            <SectionBlock label="TODAY" bucket={data.today} selectedId={selectedId} onSelect={handleSelect} />
          ) : null}
          {showWeek ? (
            <SectionBlock label="THIS WEEK" bucket={data.week} selectedId={selectedId} onSelect={handleSelect} />
          ) : null}
          {showWeekend ? (
            <SectionBlock label="THIS WEEKEND" bucket={data.weekend} selectedId={selectedId} onSelect={handleSelect} />
          ) : null}
        </div>
        <div className={styles.detailCol}>
          <UpcomingDetailPanel event={selected} />
        </div>
      </div>
    </div>
  );
}
