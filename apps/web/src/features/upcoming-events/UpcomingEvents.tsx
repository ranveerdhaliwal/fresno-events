import { useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";

import { CtaRow } from "@/components/CtaRow";
import { EventCard } from "@/components/EventCard";
import { EventRow } from "@/components/EventRow";
import { ViewToggle, type ViewMode } from "@/components/ViewToggle";
import { WeekBlockHeader } from "@/components/WeekBlockHeader";
import { toEventRowViewModel } from "@/lib/event-view-model";
import { formatEventDate } from "@/lib/event-time";

import { useTodayEvents } from "@/features/featured-events/useTodayEvents";
import { UpcomingDetailPanel } from "./UpcomingDetailPanel";
import styles from "./UpcomingEvents.module.css";

const FILTERS = ["All", "Tonight", "Free", "Music", "Family", "Downtown"] as const;

function isMobileViewport() {
  return typeof window !== "undefined" && window.matchMedia("(max-width: 600px)").matches;
}

export function UpcomingEvents() {
  const { data, isLoading } = useTodayEvents();
  const navigate = useNavigate();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [filter, setFilter] = useState<string>("All");
  const [viewMode, setViewMode] = useState<ViewMode>("list");

  const rows = useMemo(() => {
    if (!data) return [];
    let mapped = data.items.map((item) => toEventRowViewModel(item));
    if (filter === "Tonight") {
      mapped = mapped.filter((row) => row.featuredBadge === "tonight");
    } else if (filter === "Free") {
      mapped = mapped.filter((row) => row.isFree);
    } else if (filter === "Music") {
      mapped = mapped.filter((row) => row.categoryLabel.toLowerCase().includes("music"));
    } else if (filter === "Family") {
      mapped = mapped.filter((row) => row.categoryLabel.toLowerCase().includes("family"));
    } else if (filter === "Downtown") {
      mapped = mapped.filter((row) => row.neighborhood.toLowerCase().includes("downtown"));
    }
    return mapped;
  }, [data, filter]);

  const selected = rows.find((row) => row.id === selectedId) ?? rows[0] ?? null;

  const handleSelect = (id: string, slug: string) => {
    if (isMobileViewport()) {
      void navigate({ to: "/event/$slug", params: { slug } });
      return;
    }
    setSelectedId(id);
  };

  const nextWeekLabel = useMemo(() => {
    const start = new Date();
    start.setDate(start.getDate() + 7);
    const end = new Date(start);
    end.setDate(end.getDate() + 6);
    const fmt = (d: Date) =>
      new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", timeZone: "America/Los_Angeles" }).format(d);
    return `${fmt(start).toUpperCase()} – ${fmt(end).toUpperCase()}`;
  }, []);

  if (isLoading) {
    return <div className={styles.loading}>Loading upcoming events…</div>;
  }

  return (
    <div className={styles.wrap} data-testid="upcoming-events">
      <div className={styles.toolbar}>
        <h2>
          <span className={styles.script}>upcoming</span> EVENTS
        </h2>
        <span className={styles.sub}>{rows.length} on the radar</span>
        <ViewToggle value={viewMode} onChange={setViewMode} />
      </div>

      <div className={styles.chips}>
        {FILTERS.map((chip) => (
          <button
            key={chip}
            type="button"
            className={filter === chip ? styles.chipActive : styles.chip}
            onClick={() => setFilter(chip)}
          >
            {chip}
          </button>
        ))}
      </div>

      <div className={styles.split}>
        <div className={styles.listCol}>
          <WeekBlockHeader label="THIS WEEK" dateRange={formatEventDate(new Date())} />
          <div className={styles.list}>
            {rows.map((row) => (
              <div key={row.id} className={styles.rowWrap}>
                <EventRow
                  event={row}
                  isSelected={selected?.id === row.id}
                  onSelect={() => handleSelect(row.id, row.slug)}
                />
                <EventCard event={row} />
              </div>
            ))}
          </div>
          <WeekBlockHeader label="NEXT WEEK" dateRange={nextWeekLabel} />
          <div className={styles.ctaWrap}>
            <CtaRow />
          </div>
        </div>
        <div className={styles.detailCol}>
          <UpcomingDetailPanel event={selected} />
        </div>
      </div>
    </div>
  );
}
