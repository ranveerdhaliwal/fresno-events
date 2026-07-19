import { Link, useNavigate, useParams } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { AdSlot } from "@/components/AdSlot";
import { ForwardDayStrip } from "@/components/DayStrip/ForwardDayStrip";
import { PageChrome } from "@/components/PageChrome";
import { PopularList } from "@/components/PopularList";
import { SectionTitle } from "@/components/SectionTitle";
import { Text } from "@/components/Text";
import { DaySchedule } from "@/features/day-schedule/DaySchedule";
import { useDayEvents } from "@/features/day-schedule/useDayEvents";
import { useForwardDayEvents } from "@/features/today-strip/useForwardDayEvents";
import { toPopularViewModels } from "@/lib/event-view-model";
import { parseDayParam } from "@/lib/parse-day-param";
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

  const { data: rangeData } = useForwardDayEvents();
  const { data: dayData } = useDayEvents(viewDate);

  useEffect(() => {
    if (skipRouteSyncRef.current) {
      skipRouteSyncRef.current = false;
      return;
    }
    setViewDate(routeDate);
  }, [routeDate]);

  const handleViewDateChange = useCallback(
    (nextIso: string) => {
      setViewDate(nextIso);
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
    for (const item of rangeData?.items ?? []) {
      const iso = toIsoDateLocal(new Date(item.event.startTs));
      counts.set(iso, (counts.get(iso) ?? 0) + 1);
    }
    return counts;
  }, [rangeData]);

  const popular = useMemo(() => toPopularViewModels(dayData?.items ?? [], 5), [dayData]);
  const eventCount = dayData?.items.length ?? 0;

  useSeoHead(useMemo(() => buildDaySeo(viewDate, eventCount), [viewDate, eventCount]));

  return (
    <PageChrome mobileNav={{ variant: "day", title: dayTitle.toUpperCase() }}>
      <div className={styles.wrap} data-testid="day-page">
        <Text variant="body3" tone="mutedOnPage" as="p" className={styles.crumb}>
          <Link to="/">Home</Link> / <span>{dayTitle}</span>
        </Text>

        <header className={styles.hero}>
          <div>
            <SectionTitle script="what's on" size="lg" as="h1">
              {dayTitle.toUpperCase()}
            </SectionTitle>
            <div className={styles.meta}>
              <Text variant="body2" tone="label" as="span">
                📅 {formatEventDate(new Date(`${viewDate}T12:00:00-07:00`))}
              </Text>
              <Text variant="body2" tone="label" as="span">
                📆 {eventCount} events
              </Text>
            </div>
          </div>
        </header>

        <ForwardDayStrip
          selectedIso={viewDate}
          onSelectDate={handleViewDateChange}
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
