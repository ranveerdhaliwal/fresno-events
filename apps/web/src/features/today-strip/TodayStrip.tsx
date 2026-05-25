import { Link } from "@tanstack/react-router";
import { useMemo } from "react";

import { DayStrip } from "@/components/DayStrip";
import { WeatherChip } from "@/components/WeatherChip";
import { buildDayStripTiles } from "@/lib/event-view-model";
import { formatEventDate, toIsoDateLocal } from "@/lib/event-time";

import { useTodayEvents } from "@/features/featured-events/useTodayEvents";
import styles from "./TodayStrip.module.css";

export function TodayStrip() {
  const { data } = useTodayEvents();
  const today = new Date();
  const todayIso = toIsoDateLocal(today);

  const tiles = useMemo(() => {
    const counts = new Map<string, number>();
    for (const item of data?.items ?? []) {
      const iso = toIsoDateLocal(new Date(item.event.startTs));
      counts.set(iso, (counts.get(iso) ?? 0) + 1);
    }
    return buildDayStripTiles(today, counts);
  }, [data, today]);

  return (
    <section className={styles.section} data-testid="today-strip">
      <div className={styles.head}>
        <h2>
          <Link to="/day/$date" params={{ date: todayIso }}>
            <span className={styles.script}>today&apos;s</span> LINEUP <span className={styles.arrow}>→</span>
          </Link>
        </h2>
        <span className={styles.sub}>{formatEventDate(today)} · Fresno, CA</span>
        <WeatherChip />
      </div>
      <DayStrip tiles={tiles} />
    </section>
  );
}
