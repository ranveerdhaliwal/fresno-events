import { useMemo, useState } from "react";

import { SecHead } from "@/components/SecHead";
import { SelectableEventRow } from "@/components/SelectableEventRow";
import { Text } from "@/components/Text";
import { useBrowseEventSelect } from "@/hooks/useIsMobile";
import { bucketPeriod, type DayPeriod } from "@/lib/event-time";
import { toEventRowViewModel } from "@/lib/event-view-model";
import { UpcomingDetailPanel } from "@/features/upcoming-events/UpcomingDetailPanel";
import patternStyles from "@/styles/patterns.module.css";
import { DayScheduleSkeleton } from "./DayScheduleSkeleton";
import { useDayEvents } from "./useDayEvents";
import styles from "./DaySchedule.module.css";

const PERIODS: { id: Exclude<DayPeriod, "live">; title: string; script?: string }[] = [
  { id: "morning", title: "MORNING", script: "early" },
  { id: "afternoon", title: "AFTERNOON", script: "midday" },
  { id: "evening", title: "EVENING & NIGHT", script: "after dark" }
];

function schedulePeriod(startTs: string, endTs: string | undefined, now: Date): Exclude<DayPeriod, "live"> {
  const period = bucketPeriod(startTs, endTs, now);
  if (period === "live") {
    const hour = Number(
      new Intl.DateTimeFormat("en-US", {
        hour: "numeric",
        hour12: false,
        timeZone: "America/Los_Angeles"
      }).format(new Date(startTs))
    );
    if (hour < 12) return "morning";
    if (hour < 17) return "afternoon";
    return "evening";
  }
  return period;
}

export interface DayScheduleProps {
  isoDate: string;
  onNavigateEvent: (slug: string) => void;
}

export function DaySchedule({ isoDate, onNavigateEvent }: DayScheduleProps) {
  const { data, isLoading } = useDayEvents(isoDate);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const now = new Date();
  const handleSelect = useBrowseEventSelect({
    onSelectInSplit: setSelectedId,
    onOpenEvent: onNavigateEvent
  });

  const rows = useMemo(() => {
    if (!data) return [];
    return data.items.map((item) => toEventRowViewModel(item, now));
  }, [data, now]);

  const byPeriod = useMemo(() => {
    const map = new Map<Exclude<DayPeriod, "live">, typeof rows>();
    for (const period of PERIODS) {
      map.set(period.id, []);
    }
    if (!data) return map;
    for (const item of data.items) {
      const period = schedulePeriod(item.event.startTs, item.event.endTs, now);
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

  if (isLoading) {
    return <DayScheduleSkeleton />;
  }

  return (
    <div className={patternStyles.browseSplit} data-testid="day-schedule">
      <div className={styles.listCol}>
        {PERIODS.map((period) => {
          const events = byPeriod.get(period.id) ?? [];
          return (
            <section key={period.id} className={styles.section}>
              <SecHead
                title={period.title}
                {...(period.script ? { script: period.script } : {})}
                count={events.length}
              />
              {events.length === 0 ? (
                <Text variant="body2" tone="mutedOnPage" className={styles.empty}>
                  No events in this block yet.
                </Text>
              ) : (
                <div className={patternStyles.list}>
                  {events.map((row) => (
                    <SelectableEventRow
                      key={row.id}
                      event={row}
                      isSelected={selected?.id === row.id}
                      isLive={row.isLive}
                      onSelect={handleSelect}
                    />
                  ))}
                </div>
              )}
            </section>
          );
        })}
      </div>
      <div className={patternStyles.detailCol}>
        <UpcomingDetailPanel event={selected} />
      </div>
    </div>
  );
}
