import { useMemo, useState } from "react";

import { EventCard } from "@/components/EventCard";
import { EventRow } from "@/components/EventRow";
import { SecHead } from "@/components/SecHead";
import { ShowMore } from "@/components/ShowMore";
import { bucketPeriod, isLiveNow, type DayPeriod } from "@/lib/event-time";
import { toEventRowViewModel } from "@/lib/event-view-model";
import { UpcomingDetailPanel } from "@/features/upcoming-events/UpcomingDetailPanel";
import { useDayEvents } from "./useDayEvents";
import styles from "./DaySchedule.module.css";

const PERIODS: { id: DayPeriod; title: string; script?: string }[] = [
  { id: "live", title: "LIVE OR ONGOING", script: "right now" },
  { id: "morning", title: "MORNING", script: "early" },
  { id: "afternoon", title: "AFTERNOON", script: "midday" },
  { id: "evening", title: "EVENING & NIGHT", script: "after dark" }
];

function isMobileViewport() {
  return typeof window !== "undefined" && window.matchMedia("(max-width: 600px)").matches;
}

export interface DayScheduleProps {
  isoDate: string;
  onNavigateEvent: (slug: string) => void;
}

export function DaySchedule({ isoDate, onNavigateEvent }: DayScheduleProps) {
  const { data, isLoading } = useDayEvents(isoDate);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const now = new Date();

  const rows = useMemo(() => {
    if (!data) return [];
    return data.items.map((item) => {
      const row = toEventRowViewModel(item, now);
      return { ...row, isLive: isLiveNow(item.event.startTs, item.event.endTs, now) };
    });
  }, [data, now]);

  const byPeriod = useMemo(() => {
    const map = new Map<DayPeriod, typeof rows>();
    for (const period of PERIODS) {
      map.set(period.id, []);
    }
    if (!data) return map;
    for (const item of data.items) {
      const period = bucketPeriod(item.event.startTs, item.event.endTs, now);
      const row = rows.find((r) => r.id === item.event.id);
      if (row) {
        const list = map.get(period) ?? [];
        list.push(row);
        map.set(period, list);
      }
    }
    return map;
  }, [data, rows, now]);

  const selected = rows.find((r) => r.id === selectedId) ?? rows[0] ?? null;

  const handleSelect = (id: string, slug: string) => {
    if (isMobileViewport()) {
      onNavigateEvent(slug);
      return;
    }
    setSelectedId(id);
  };

  if (isLoading) {
    return <p className={styles.loading}>Loading day schedule…</p>;
  }

  return (
    <div className={styles.split} data-testid="day-schedule">
      <div className={styles.listCol}>
        {PERIODS.map((period) => {
          const events = byPeriod.get(period.id) ?? [];
          const live = period.id === "live";
          return (
            <section key={period.id} className={styles.section}>
              <SecHead
                title={period.title}
                {...(period.script ? { script: period.script } : {})}
                count={events.length}
                variant={live ? "live" : "default"}
              />
              {events.length === 0 ? (
                <p className={styles.empty}>
                  {live ? "Nothing live right now — check back closer to showtime." : "No events in this block yet."}
                </p>
              ) : (
                <div className={styles.list}>
                  {events.map((row) => (
                    <div key={row.id} className={styles.rowWrap}>
                      <EventRow
                        event={row}
                        isSelected={selected?.id === row.id}
                        isLive={row.isLive}
                        onSelect={() => handleSelect(row.id, row.slug)}
                      />
                      <EventCard event={row} />
                    </div>
                  ))}
                </div>
              )}
              {events.length > 0 ? <ShowMore /> : null}
            </section>
          );
        })}
      </div>
      <div className={styles.detailCol}>
        <UpcomingDetailPanel event={selected} />
      </div>
    </div>
  );
}
