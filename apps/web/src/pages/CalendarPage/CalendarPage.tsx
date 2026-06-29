import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { isoDateInPacificMonth, pacificTodayIso } from "@fresno-events/shared";

import { CalendarDayTile } from "@/components/CalendarDayTile";
import { isPacificWeekend } from "@/components/CalendarDayTile/CalendarDayTile.utils";
import { CalendarMonthStrip } from "@/components/CalendarMonthStrip";
import { PageChrome } from "@/components/PageChrome";
import { EventRow } from "@/components/EventRow";
import { UpcomingDetailPanel } from "@/features/upcoming-events/UpcomingDetailPanel";
import { toEventRowViewModel } from "@/lib/event-view-model";
import { buildCalendarSeo } from "@/lib/seo/page-seo";
import { useSeoHead } from "@/lib/seo/useSeoHead";
import { getCalendarMonth } from "@/services/events.service";
import { eventsKeys } from "@/services/events.queryKeys";

import styles from "./CalendarPage.module.css";

const DOW_HEADERS = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"] as const;

export interface CalendarPageProps {
  year: number;
  month: number;
}

export function CalendarPage({ year, month }: CalendarPageProps) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const todayIso = pacificTodayIso();
  useSeoHead(useMemo(() => buildCalendarSeo(year, month), [year, month]));
  const { data, isLoading } = useQuery({
    queryKey: eventsKeys.calendar(year, month),
    queryFn: ({ signal }) => getCalendarMonth(year, month, signal)
  });

  const monthLabel = useMemo(
    () =>
      new Intl.DateTimeFormat("en-US", { month: "long", year: "numeric", timeZone: "America/Los_Angeles" }).format(
        new Date(`${year}-${String(month).padStart(2, "0")}-01T12:00:00-07:00`)
      ),
    [month, year]
  );

  const weekRows = useMemo(() => {
    if (!data) return [];
    return data.weeks.flatMap((week) => week.preview.map((item) => toEventRowViewModel(item)));
  }, [data]);

  const selected = weekRows.find((row) => row.id === selectedId) ?? weekRows[0] ?? null;

  return (
    <PageChrome mobileNav={{ variant: "day", title: "CALENDAR" }}>
      <div className={styles.wrap} data-testid="calendar-page">
        <header className={styles.head}>
          <h1>
            <span className={styles.script}>the</span> {monthLabel.toUpperCase()}
          </h1>
        </header>

        {isLoading || !data ? (
          <p className={styles.loading}>Loading calendar…</p>
        ) : (
          <>
            <div className={styles.dowRow}>
              {DOW_HEADERS.map((label) => (
                <span key={label} className={styles.dowHead}>
                  {label}
                </span>
              ))}
            </div>

            <div className={styles.grid}>
              {data.days.map((day) => (
                <CalendarDayTile
                  key={day.isoDate}
                  isoDate={day.isoDate}
                  preview={day.preview}
                  hidden={day.hidden}
                  total={day.total}
                  inMonth={isoDateInPacificMonth(day.isoDate, year, month)}
                  isToday={day.isoDate === todayIso}
                  isWeekend={isPacificWeekend(day.isoDate)}
                />
              ))}
            </div>

            <CalendarMonthStrip selectedYear={year} selectedMonth={month} />

            <div className={styles.split}>
              <div className={styles.weekList}>
                <h2 className={styles.weekHeading}>
                  <span className={styles.script}>this</span> MONTH BY WEEK
                </h2>
                {data.weeks.map((week) => (
                  <section key={week.label} className={styles.weekBlock}>
                    <h3>{week.label}</h3>
                    {week.preview.length === 0 ? (
                      <p className={styles.empty}>No events yet</p>
                    ) : (
                      week.preview.map((item) => {
                        const row = toEventRowViewModel(item);
                        return (
                          <EventRow
                            key={row.id}
                            event={row}
                            isSelected={selected?.id === row.id}
                            onSelect={() => setSelectedId(row.id)}
                          />
                        );
                      })
                    )}
                  </section>
                ))}
              </div>
              <UpcomingDetailPanel event={selected} />
            </div>
          </>
        )}
      </div>
    </PageChrome>
  );
}
