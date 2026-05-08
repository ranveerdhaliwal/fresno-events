import { Link } from "@tanstack/react-router";
import { ArrowLeft, ArrowRight, CalendarDays, Clock3, Loader2, MapPin } from "lucide-react";
import { useMemo, useState } from "react";

import type { TodayEventItem } from "./types";
import { useWeekEvents } from "./use-event-queries";

const timeZone = "America/Los_Angeles";

export function CalendarPage() {
  const [anchorDate, setAnchorDate] = useState(() => startOfDay(new Date()));
  const weekStart = useMemo(() => startOfDay(anchorDate), [anchorDate]);
  const weekEnd = useMemo(() => addDays(weekStart, 7), [weekStart]);
  const days = useMemo(() => Array.from({ length: 7 }, (_, index) => addDays(weekStart, index)), [weekStart]);
  const { data, isLoading, isError, refetch } = useWeekEvents(weekStart, weekEnd);
  const groups = groupByDay(data?.items ?? [], days);

  return (
    <div className="space-y-6 pb-2 md:pb-0">
      <section className="grid gap-5 rounded-[2rem] border border-border/70 bg-card p-5 shadow-soft lg:grid-cols-[minmax(0,1fr)_18rem] lg:p-7">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.26em] text-accent">Calendar / Fresno</p>
          <h1 className="mt-3 max-w-3xl font-display text-4xl font-semibold leading-none tracking-[-0.052em] text-foreground sm:text-5xl">
            One week, sorted by the day you can actually go.
          </h1>
          <p className="mt-4 max-w-2xl text-base leading-7 text-muted-foreground">
            Browse a focused seven-day window, jump to a date, then open the events that need tickets,
            details, or a little extra planning.
          </p>
        </div>

        <div className="rounded-[1.35rem] bg-background/70 p-4">
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-muted-foreground">Viewing</p>
          <p className="mt-2 font-display text-2xl font-semibold tracking-[-0.035em] text-foreground">
            {formatRange(weekStart, addDays(weekEnd, -1))}
          </p>
          <label className="mt-4 block text-sm font-semibold text-foreground" htmlFor="calendar-date">
            Jump to date
          </label>
          <input
            id="calendar-date"
            type="date"
            value={toInputDate(anchorDate)}
            onChange={(event) => setAnchorDate(fromInputDate(event.currentTarget.value))}
            className="mt-2 min-h-11 w-full rounded-2xl border border-border bg-card px-3 text-sm text-foreground outline-none transition focus-visible:ring-2 focus-visible:ring-ring"
          />
        </div>
      </section>

      <div className="grid gap-3 sm:flex sm:flex-wrap sm:items-center sm:justify-between">
        <button
          type="button"
          onClick={() => setAnchorDate((date) => addDays(date, -7))}
          className="inline-flex min-h-11 items-center justify-center gap-2 rounded-full border border-border bg-card px-4 text-sm font-bold text-foreground transition hover:border-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <ArrowLeft aria-hidden="true" className="size-4" />
          Previous week
        </button>
        <button
          type="button"
          onClick={() => setAnchorDate(startOfDay(new Date()))}
          className="inline-flex min-h-11 items-center justify-center rounded-full bg-primary px-4 text-sm font-bold text-primary-foreground transition hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          Back to today
        </button>
        <button
          type="button"
          onClick={() => setAnchorDate((date) => addDays(date, 7))}
          className="inline-flex min-h-11 items-center justify-center gap-2 rounded-full border border-border bg-card px-4 text-sm font-bold text-foreground transition hover:border-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          Next week
          <ArrowRight aria-hidden="true" className="size-4" />
        </button>
      </div>

      {isLoading ? <CalendarLoading /> : null}

      {isError ? (
        <section className="rounded-[1.5rem] border border-border bg-card p-6">
          <h2 className="font-display text-3xl font-semibold tracking-[-0.04em] text-foreground">
            The calendar did not load.
          </h2>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            Try again, or come back in a minute while the event feed catches up.
          </p>
          <button
            type="button"
            onClick={() => void refetch()}
            className="mt-4 inline-flex min-h-11 items-center rounded-full bg-primary px-4 text-sm font-bold text-primary-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            Retry
          </button>
        </section>
      ) : null}

      {!isLoading && !isError ? (
        <div className="space-y-4">
          {groups.map((group) => (
            <DaySection key={group.key} day={group.day} events={group.events} />
          ))}
        </div>
      ) : null}
    </div>
  );
}

function DaySection({ day, events }: { day: Date; events: TodayEventItem[] }) {
  const isToday = day.toDateString() === new Date().toDateString();

  return (
    <section className="grid gap-3 border-t border-border/70 pt-4 md:grid-cols-[10rem_minmax(0,1fr)]">
      <div className="md:sticky md:top-24 md:h-fit">
        <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.22em] text-accent">
          <CalendarDays aria-hidden="true" className="size-4" />
          {isToday ? "Today" : formatWeekday(day)}
        </p>
        <h2 className="mt-1 font-display text-2xl font-semibold tracking-[-0.04em] text-foreground sm:text-3xl">
          {formatMonthDay(day)}
        </h2>
      </div>

      <div className="space-y-3">
        {events.length > 0 ? (
          events.map((event) => <AgendaRow key={event.event.id} event={event} />)
        ) : (
          <div className="rounded-[1.35rem] bg-muted/55 px-4 py-5 text-sm leading-6 text-muted-foreground">
            Nothing published for this day yet. New events will land here as sources are reviewed.
          </div>
        )}
      </div>
    </section>
  );
}

function AgendaRow({ event }: { event: TodayEventItem }) {
  return (
    <Link
      to="/event/$slug"
      params={{ slug: event.event.slug }}
      className="group grid gap-4 rounded-[1.35rem] bg-card p-3 outline-none transition hover:bg-muted/60 focus-visible:ring-2 focus-visible:ring-ring sm:grid-cols-[7.5rem_minmax(0,1fr)_auto]"
    >
      <div className="relative min-h-28 overflow-hidden rounded-[1rem] bg-muted">
        {event.heroImage ? (
          <img
            src={event.heroImage.cdnUrl}
            alt={event.heroImage.altText ?? ""}
            className="h-full w-full object-cover transition duration-300 group-hover:scale-[1.03]"
          />
        ) : (
          <div className="grid h-full place-items-center text-xs font-semibold uppercase tracking-[0.22em] text-muted-foreground">
            Fresno
          </div>
        )}
      </div>

      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-accent">
          <span>{event.kicker}</span>
          <span>{event.event.category.replace("_", " ")}</span>
        </div>
        <h3 className="mt-2 font-display text-[1.7rem] font-semibold leading-tight tracking-[-0.035em] text-foreground sm:text-2xl">
          {event.event.title}
        </h3>
        <p className="mt-2 line-clamp-2 text-sm leading-6 text-muted-foreground">{event.event.descriptionText}</p>
        <div className="mt-3 flex flex-wrap gap-x-4 gap-y-2 text-sm font-medium text-muted-foreground">
          <span className="inline-flex items-center gap-1.5">
            <Clock3 aria-hidden="true" className="size-4" />
            {event.timeLabel}
          </span>
          <span className="inline-flex items-center gap-1.5">
            <MapPin aria-hidden="true" className="size-4" />
            {event.venue.name}
          </span>
        </div>
      </div>

      <div className="flex items-center justify-between gap-3 border-t border-border/70 pt-3 sm:flex-col sm:items-end sm:border-l sm:border-t-0 sm:pl-4 sm:pt-0">
        <span className="rounded-full bg-background px-3 py-1.5 text-sm font-bold text-foreground">
          {event.priceLabel}
        </span>
        <span className="text-sm font-semibold text-muted-foreground">{event.neighborhood}</span>
      </div>
    </Link>
  );
}

function CalendarLoading() {
  return (
    <div className="grid min-h-80 place-items-center rounded-[1.75rem] border border-border/70 bg-card">
      <div className="text-center">
        <Loader2 aria-hidden="true" className="mx-auto size-7 animate-spin text-accent" />
        <p className="mt-3 text-sm font-semibold text-muted-foreground">Loading this week</p>
      </div>
    </div>
  );
}

function groupByDay(events: TodayEventItem[], days: Date[]) {
  return days.map((day) => {
    const key = toInputDate(day);
    return {
      key,
      day,
      events: events.filter((event) => toInputDate(new Date(event.event.startTs)) === key)
    };
  });
}

function startOfDay(date: Date) {
  const next = new Date(date);
  next.setHours(0, 0, 0, 0);
  return next;
}

function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function toInputDate(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function fromInputDate(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  return startOfDay(new Date(year ?? new Date().getFullYear(), (month ?? 1) - 1, day ?? 1));
}

function formatWeekday(date: Date) {
  return new Intl.DateTimeFormat("en-US", { weekday: "long", timeZone }).format(date);
}

function formatMonthDay(date: Date) {
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", timeZone }).format(date);
}

function formatRange(from: Date, until: Date) {
  return `${formatMonthDay(from)} to ${formatMonthDay(until)}`;
}
