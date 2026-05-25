import { Link, useNavigate, useParams } from "@tanstack/react-router";
import { useMemo } from "react";

import { AdSlot } from "@/components/AdSlot";
import { DayStrip } from "@/components/DayStrip";
import { PageChrome } from "@/components/PageChrome";
import { PopularList } from "@/components/PopularList";
import { WeatherChip } from "@/components/WeatherChip";
import { DaySchedule } from "@/features/day-schedule/DaySchedule";
import { useTodayEvents } from "@/features/featured-events/useTodayEvents";
import { buildDayStripTiles, toPopularViewModels } from "@/lib/event-view-model";
import { addDaysIso, dayBoundsPacific, parseDayParam } from "@/lib/parse-day-param";
import { formatEventDate, toIsoDateLocal } from "@/lib/event-time";

import styles from "./DayPage.module.css";

export function DayPage() {
  const { date: rawDate = toIsoDateLocal(new Date()) } = useParams({ strict: false });
  const navigate = useNavigate();
  const isoDate = parseDayParam(rawDate);
  const { data: weekData } = useTodayEvents();

  const dayTitle = useMemo(() => {
    const d = new Date(`${isoDate}T12:00:00-07:00`);
    return new Intl.DateTimeFormat("en-US", {
      weekday: "long",
      month: "long",
      day: "numeric",
      timeZone: "America/Los_Angeles"
    }).format(d);
  }, [isoDate]);

  const tiles = useMemo(() => {
    const anchor = new Date(`${isoDate}T12:00:00-07:00`);
    const counts = new Map<string, number>();
    for (const item of weekData?.items ?? []) {
      const iso = toIsoDateLocal(new Date(item.event.startTs));
      counts.set(iso, (counts.get(iso) ?? 0) + 1);
    }
    return buildDayStripTiles(anchor, counts);
  }, [isoDate, weekData]);

  const popular = useMemo(() => {
    const { from, until } = dayBoundsPacific(isoDate);
    const dayItems =
      weekData?.items.filter((item) => {
        const t = new Date(item.event.startTs).getTime();
        return t >= from.getTime() && t <= until.getTime();
      }) ?? [];
    return toPopularViewModels(dayItems, 5);
  }, [isoDate, weekData]);

  const eventCount = popular.length > 0 ? popular.length : weekData?.items.length ?? 0;

  return (
    <PageChrome mobileNav={{ variant: "day", title: dayTitle.toUpperCase() }} showBottomTabs>
      <div className={styles.wrap} data-testid="day-page">
        <p className={styles.crumb}>
          <Link to="/">Home</Link> / <span>{dayTitle}</span>
        </p>

        <header className={styles.hero}>
          <div>
            <h1>
              <span className={styles.script}>what&apos;s on</span> {dayTitle.toUpperCase()}
            </h1>
            <div className={styles.meta}>
              <span>📅 {formatEventDate(new Date(`${isoDate}T12:00:00-07:00`))}</span>
              <span>📆 {eventCount} events</span>
              <WeatherChip />
            </div>
          </div>
          <div className={styles.arrows}>
            <Link to="/day/$date" params={{ date: addDaysIso(isoDate, -1) }} className={styles.arrow}>
              ← PREV
            </Link>
            <Link to="/day/$date" params={{ date: addDaysIso(isoDate, 1) }} className={`${styles.arrow} ${styles.next}`}>
              NEXT →
            </Link>
          </div>
        </header>

        <DayStrip tiles={tiles} />

        <div className={styles.popularRow}>
          <PopularList title="POPULAR TODAY" events={popular} count={popular.length} />
          <AdSlot variant="banner-stacked" />
        </div>

        <div className={styles.stripe} aria-hidden />

        <DaySchedule isoDate={isoDate} onNavigateEvent={(slug) => void navigate({ to: "/event/$slug", params: { slug } })} />
      </div>
    </PageChrome>
  );
}
