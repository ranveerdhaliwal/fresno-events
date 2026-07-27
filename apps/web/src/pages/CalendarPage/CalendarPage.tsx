import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { isoDateInPacificMonth, pacificTodayIso } from "@fresno-events/shared";

import { CalendarDayTile } from "@/components/CalendarDayTile";
import { isPacificWeekend } from "@/components/CalendarDayTile/CalendarDayTile.utils";
import { CalendarMonthStrip } from "@/components/CalendarMonthStrip";
import { PageChrome } from "@/components/PageChrome";
import { SectionTitle } from "@/components/SectionTitle";
import { SelectableEventRow } from "@/components/SelectableEventRow";
import { Text } from "@/components/Text";
import { UpcomingDetailPanel } from "@/features/upcoming-events/UpcomingDetailPanel";
import { useBrowseEventSelect } from "@/hooks/useIsMobile";
import { cn } from "@/lib/cn";
import { toEventRowViewModel } from "@/lib/event-view-model";
import { buildCalendarSeo } from "@/lib/seo/page-seo";
import { useSeoHead } from "@/lib/seo/useSeoHead";
import { getCalendarMonth } from "@/services/events.service";
import { eventsKeys } from "@/services/events.queryKeys";
import patternStyles from "@/styles/patterns.module.css";

import { CalendarPageSkeleton } from "./CalendarPageSkeleton";
import styles from "./CalendarPage.module.css";

const DOW_HEADERS = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"] as const;

export interface CalendarPageProps {
  year: number;
  month: number;
}

export function CalendarPage({ year, month }: CalendarPageProps) {
  const navigate = useNavigate();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const todayIso = pacificTodayIso();
  useSeoHead(useMemo(() => buildCalendarSeo(year, month), [year, month]));
  const { data, isLoading } = useQuery({
    queryKey: eventsKeys.calendar(year, month),
    queryFn: ({ signal }) => getCalendarMonth(year, month, signal)
  });

  const handleSelect = useBrowseEventSelect({
    onSelectInSplit: setSelectedId,
    onOpenEvent: (slug) => {
      void navigate({ to: "/event/$slug", params: { slug } });
    }
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
          <SectionTitle script="the" size="lg" as="h1">
            {monthLabel.toUpperCase()}
          </SectionTitle>
        </header>

        {isLoading || !data ? (
          <CalendarPageSkeleton monthLabel={monthLabel} />
        ) : (
          <>
            <div className={styles.dowRow}>
              {DOW_HEADERS.map((label) => (
                <Text key={label} variant="eyebrow" tone="label" as="span" className={styles.dowHead}>
                  {label}
                </Text>
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

            <div className={cn(patternStyles.browseSplit, styles.monthSplit)} data-testid="calendar-browse-split">
              <div className={styles.weekList}>
                <SectionTitle script="this" size="sm" as="h2" className={styles.weekHeading}>
                  MONTH BY WEEK
                </SectionTitle>
                {data.weeks.map((week) => (
                  <section key={week.label} className={styles.weekBlock}>
                    <Text variant="header3" tone="onPage" as="h3">
                      {week.label}
                    </Text>
                    {week.preview.length === 0 ? (
                      <Text variant="body2" tone="mutedOnPage" className={styles.empty}>
                        No events yet
                      </Text>
                    ) : (
                      <div className={patternStyles.list}>
                        {week.preview.map((item) => {
                          const row = toEventRowViewModel(item);
                          return (
                            <SelectableEventRow
                              key={row.id}
                              event={row}
                              isSelected={selected?.id === row.id}
                              isLive={row.isLive}
                              onSelect={handleSelect}
                            />
                          );
                        })}
                      </div>
                    )}
                  </section>
                ))}
              </div>
              <div className={patternStyles.detailCol}>
                <UpcomingDetailPanel event={selected} />
              </div>
            </div>
          </>
        )}
      </div>
    </PageChrome>
  );
}
