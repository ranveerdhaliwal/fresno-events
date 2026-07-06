import { Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";

import { FilterChip } from "@/components/FilterChip";
import { DayStrip } from "@/components/DayStrip";
import { Text } from "@/components/Text";
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
        <h2 className={styles.headTitle}>
          {tab === "month" ? (
            <Link to="/calendar" search={calendarSearchCurrent()} className={styles.headLink}>
              <Text variant="script" tone="accent" scriptStyle="section" as="span">
                the
              </Text>{" "}
              <Text variant="header1" tone="onPage" as="span" className={styles.headDisplay}>
                LINEUP
              </Text>{" "}
              <span className={styles.arrow}>→</span>
            </Link>
          ) : (
            <Link to="/day/$date" params={{ date: todayIso }} className={styles.headLink}>
              <Text variant="script" tone="accent" scriptStyle="section" as="span">
                the
              </Text>{" "}
              <Text variant="header1" tone="onPage" as="span" className={styles.headDisplay}>
                LINEUP
              </Text>{" "}
              <span className={styles.arrow}>→</span>
            </Link>
          )}
        </h2>
        <div className={styles.tabs}>
          {TABS.map((item) => (
            <FilterChip key={item.id} active={tab === item.id} onClick={() => setTab(item.id)}>
              {item.label}
            </FilterChip>
          ))}
        </div>
        <Text variant="body3" tone="label" as="span" className={styles.sub}>
          {formatEventDate(today)} · Fresno, CA
        </Text>
      </div>
      <DayStrip tiles={tiles} />
    </section>
  );
}
