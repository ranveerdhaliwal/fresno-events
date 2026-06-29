import { Link, useNavigate, useParams } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { AdSlot } from "@/components/AdSlot";
import { DayDateCarousel } from "@/components/DayDateCarousel";
import { PageChrome } from "@/components/PageChrome";
import { PopularList } from "@/components/PopularList";
import { DaySchedule } from "@/features/day-schedule/DaySchedule";
import { useTodayEvents } from "@/features/featured-events/useTodayEvents";
import { toPopularViewModels } from "@/lib/event-view-model";
import { dayBoundsPacific, parseDayParam } from "@/lib/parse-day-param";
import { formatEventDate, toIsoDateLocal } from "@/lib/event-time";
import { buildDaySeo } from "@/lib/seo/page-seo";
import { useSeoHead } from "@/lib/seo/useSeoHead";

import styles from "./DayPage.module.css";

function formatDayTitle(isoDate: string): string {
  const d = new Date(`${isoDate}T12:00:00-07:00`);
  return new Intl.DateTimeFormat("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    timeZone: "America/Los_Angeles"
  }).format(d);
}

export function DayPage() {
  const { date: rawDate = toIsoDateLocal(new Date()) } = useParams({ strict: false });
  const navigate = useNavigate();
  const routeDate = parseDayParam(rawDate);
  const [viewDate, setViewDate] = useState(routeDate);
  const skipRouteSyncRef = useRef(false);

  const { data: weekData } = useTodayEvents();

  useEffect(() => {
    if (skipRouteSyncRef.current) {
      skipRouteSyncRef.current = false;
      return;
    }
    setViewDate(routeDate);
  }, [routeDate]);

  const handleViewDateChange = useCallback((nextIso: string) => {
    setViewDate(nextIso);
  }, []);

  const syncRouteDate = useCallback(
    (nextIso: string) => {
      if (nextIso === routeDate) {
        return;
      }
      skipRouteSyncRef.current = true;
      void navigate({
        to: "/day/$date",
        params: { date: nextIso },
        replace: true,
        resetScroll: false
      });
    },
    [navigate, routeDate]
  );

  const dayTitle = useMemo(() => formatDayTitle(viewDate), [viewDate]);

  const eventCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const item of weekData?.items ?? []) {
      const iso = toIsoDateLocal(new Date(item.event.startTs));
      counts.set(iso, (counts.get(iso) ?? 0) + 1);
    }
    return counts;
  }, [weekData]);

  const popular = useMemo(() => {
    const { from, until } = dayBoundsPacific(viewDate);
    const dayItems =
      weekData?.items.filter((item) => {
        const t = new Date(item.event.startTs).getTime();
        return t >= from.getTime() && t <= until.getTime();
      }) ?? [];
    return toPopularViewModels(dayItems, 5);
  }, [viewDate, weekData]);

  const eventCount = popular.length > 0 ? popular.length : weekData?.items.length ?? 0;

  useSeoHead(useMemo(() => buildDaySeo(viewDate, eventCount), [viewDate, eventCount]));

  return (
    <PageChrome mobileNav={{ variant: "day", title: dayTitle.toUpperCase() }}>
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
              <span>📅 {formatEventDate(new Date(`${viewDate}T12:00:00-07:00`))}</span>
              <span>📆 {eventCount} events</span>
            </div>
          </div>
        </header>

        <DayDateCarousel
          selectedIso={viewDate}
          onSelectDate={handleViewDateChange}
          onRouteSync={syncRouteDate}
          eventCounts={eventCounts}
        />

        <div className={styles.popularRow}>
          <PopularList title="POPULAR TODAY" events={popular} count={popular.length} />
          <AdSlot variant="banner-stacked" />
        </div>

        <div className={styles.stripe} aria-hidden />

        <DaySchedule
          isoDate={viewDate}
          onNavigateEvent={(slug) => void navigate({ to: "/event/$slug", params: { slug } })}
        />
      </div>
    </PageChrome>
  );
}
