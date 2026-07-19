import { Link, useNavigate } from "@tanstack/react-router";
import { useMemo } from "react";
import { pacificTodayIso } from "@fresno-events/shared";

import { ForwardDayStrip } from "@/components/DayStrip/ForwardDayStrip";
import { Text } from "@/components/Text";
import { formatEventDate, toIsoDateLocal } from "@/lib/event-time";

import { useForwardDayEvents } from "./useForwardDayEvents";
import styles from "./TodayStrip.module.css";

export function TodayStrip() {
  const navigate = useNavigate();
  const { data } = useForwardDayEvents();
  const today = new Date();
  const todayIso = pacificTodayIso(today);

  const tilesCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const item of data?.items ?? []) {
      const iso = toIsoDateLocal(new Date(item.event.startTs));
      counts.set(iso, (counts.get(iso) ?? 0) + 1);
    }
    return counts;
  }, [data]);

  return (
    <section className={styles.section} data-testid="lineup-section">
      <div className={styles.head}>
        <h2 className={styles.headTitle}>
          <Link to="/day/$date" params={{ date: todayIso }} className={styles.headLink}>
            <Text variant="script" tone="brand" scriptStyle="section" as="span">
              the
            </Text>{" "}
            <Text variant="header1" tone="onPage" as="span" className={styles.headDisplay}>
              LINEUP
            </Text>{" "}
            <span className={styles.arrow}>→</span>
          </Link>
        </h2>
        <Text variant="body3" tone="label" as="span" className={styles.sub}>
          {formatEventDate(today)} · Fresno, CA
        </Text>
      </div>
      <ForwardDayStrip
        selectedIso={todayIso}
        eventCounts={tilesCounts}
        onSelectDate={(iso) => {
          void navigate({ to: "/day/$date", params: { date: iso } });
        }}
      />
    </section>
  );
}
