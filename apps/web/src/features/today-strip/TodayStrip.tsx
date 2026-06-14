import { Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";

import { DayStrip } from "@/components/DayStrip";
import { calendarSearchCurrent } from "@/lib/calendar-search.utils";
import { buildDayStripTilesThroughSunday } from "@/lib/event-view-model";
import { formatEventDate, toIsoDateLocal } from "@/lib/event-time";

import { useWeekThroughSunday } from "@/features/featured-events/useWeekThroughSunday";
import styles from "./TodayStrip.module.css";

type LineupTab = "today" | "week" | "month";

const TABS: { id: LineupTab; label: string }[] = [
  { id: "today", label: "TODAY" },
  { id: "week", label: "THIS WEEK" },
  { id: "month", label: "THIS MONTH" }
];

export function TodayStrip() {
  const { data } = useWeekThroughSunday();
  const [tab, setTab] = useState<LineupTab>("today");
  const today = new Date();
  const todayIso = toIsoDateLocal(today);

  const tiles = useMemo(() => {
    const counts = new Map<string, number>();
    for (const item of data?.items ?? []) {
      const iso = toIsoDateLocal(new Date(item.event.startTs));
      counts.set(iso, (counts.get(iso) ?? 0) + 1);
    }
    return buildDayStripTilesThroughSunday(today, counts);
  }, [data, today]);

  return (
    <section className={styles.section} data-testid="lineup-section">
      <div className={styles.head}>
        <h2>
          {tab === "month" ? (
            <Link to="/calendar" search={calendarSearchCurrent()}>
              <span className={styles.script}>the</span> LINEUP <span className={styles.arrow}>→</span>
            </Link>
          ) : (
            <Link to="/day/$date" params={{ date: todayIso }}>
              <span className={styles.script}>the</span> LINEUP <span className={styles.arrow}>→</span>
            </Link>
          )}
        </h2>
        <div className={styles.tabs}>
          {TABS.map((item) => (
            <button
              key={item.id}
              type="button"
              className={tab === item.id ? styles.tabActive : styles.tab}
              onClick={() => setTab(item.id)}
            >
              {item.label}
            </button>
          ))}
        </div>
        <span className={styles.sub}>{formatEventDate(today)} · Fresno, CA</span>
      </div>
      <DayStrip tiles={tiles} />
    </section>
  );
}
