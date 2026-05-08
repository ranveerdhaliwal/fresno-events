import { Link } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { ArrowRight, CalendarDays, Clock3, Loader2, MapPin, Sparkles, Star, Ticket } from "lucide-react";

import { cn } from "@/lib/cn";

import type { EventAccent, TodayEventItem } from "./types";
import { useTodayEvents } from "./use-today-events";

const accentClasses: Record<EventAccent, string> = {
  sunset: "from-orange-500/28 via-amber-300/14 to-transparent",
  fig: "from-fuchsia-700/24 via-rose-400/12 to-transparent",
  sky: "from-sky-500/24 via-cyan-300/12 to-transparent",
  olive: "from-lime-600/22 via-yellow-300/12 to-transparent",
  rose: "from-rose-600/24 via-orange-300/12 to-transparent"
};

const filters = ["Tonight", "This weekend", "Free", "Family-friendly", "Downtown", "Live music"];

export function TodayPage() {
  const { data, isLoading } = useTodayEvents();

  if (isLoading) {
    return <TodayLoading />;
  }

  if (!data || data.items.length === 0) {
    return <TodayEmpty />;
  }

  const topEvents = data.items.slice(0, 5);
  const supportingEvents = data.items.slice(5);
  const groupedEvents = groupByDate(supportingEvents.length > 0 ? supportingEvents : data.items.slice(1));

  if (topEvents.length === 0) {
    return <TodayEmpty />;
  }

  return (
    <div className="space-y-7 pb-2 md:pb-0">
      <section className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <TopEventsCarousel events={topEvents} />
        <DiscoveryPanel events={data.items} source={data.source} generatedAt={data.generatedAt} />
      </section>

      <section className="grid gap-4 md:grid-cols-[minmax(0,1fr)_18rem]">
        <div className="space-y-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.28em] text-accent">Up next</p>
              <h2 className="mt-2 font-display text-3xl font-semibold tracking-[-0.04em] text-foreground sm:text-4xl">
                The next few days, without the hunt
              </h2>
            </div>
            <p className="max-w-md text-sm leading-6 text-muted-foreground">
              Scan a short agenda, then jump into the full week when you want more options.
            </p>
          </div>

          {groupedEvents.map((group) => (
            <EventDayGroup key={group.dateLabel} dateLabel={group.dateLabel} events={group.items} />
          ))}
        </div>

        <aside className="h-fit rounded-[1.75rem] border border-border/70 bg-card/75 p-5 shadow-soft">
          <p className="text-xs font-semibold uppercase tracking-[0.28em] text-muted-foreground">Quick filters</p>
          <div className="mt-4 flex flex-wrap gap-2">
            {filters.map((filter) => (
              <button
                key={filter}
                type="button"
                className="rounded-full border border-border bg-background/60 px-3 py-2 text-sm font-medium text-foreground transition hover:border-accent hover:text-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                {filter}
              </button>
            ))}
          </div>
          <div className="mt-6 rounded-3xl bg-muted/70 p-4">
            <p className="text-sm font-semibold text-foreground">Browse deeper</p>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              The calendar view keeps the same feed grouped by day, with one-week controls.
            </p>
            <Link
              to="/calendar"
              className="mt-4 inline-flex min-h-11 items-center gap-2 rounded-full bg-primary px-4 text-sm font-bold text-primary-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              Open calendar
              <ArrowRight aria-hidden="true" className="size-4" />
            </Link>
          </div>
        </aside>
      </section>
    </div>
  );
}

function TopEventsCarousel({ events }: { events: TodayEventItem[] }) {
  return (
    <section className="overflow-hidden rounded-[2.25rem] border border-border/70 bg-card p-4 shadow-float sm:p-5">
      <div className="flex flex-col gap-3 px-1 pb-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.28em] text-accent">Top events</p>
          <h1 className="mt-2 max-w-2xl font-display text-4xl font-semibold leading-none tracking-[-0.055em] text-foreground sm:text-6xl">
            Start with what feels worth leaving the house for.
          </h1>
        </div>
        <Link
          to="/calendar"
          className="inline-flex min-h-11 items-center gap-2 rounded-full border border-border bg-background px-4 text-sm font-bold text-foreground transition hover:border-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          See week
          <ArrowRight aria-hidden="true" className="size-4" />
        </Link>
      </div>

      <div className="flex snap-x gap-3 overflow-x-auto pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {events.map((event, index) => (
          <TopEventCard key={event.event.id} event={event} priority={index === 0} />
        ))}
      </div>
    </section>
  );
}

function TopEventCard({ event, priority }: { event: TodayEventItem; priority: boolean }) {
  return (
    <Link
      to="/event/$slug"
      params={{ slug: event.event.slug }}
      className="group relative min-h-[22rem] w-[min(86vw,28rem)] shrink-0 snap-start overflow-hidden rounded-[1.55rem] bg-muted outline-none focus-visible:ring-2 focus-visible:ring-ring sm:min-h-[24rem]"
    >
      {event.heroImage ? (
        <img
          src={event.heroImage.cdnUrl}
          alt={event.heroImage.altText ?? ""}
          className="absolute inset-0 h-full w-full object-cover transition duration-500 group-hover:scale-[1.03]"
        />
      ) : null}
      <div className={cn("absolute inset-0 bg-gradient-to-br", accentClasses[event.accent])} />
      <div className="absolute inset-0 bg-gradient-to-t from-stone-950/86 via-stone-950/28 to-stone-950/8" />
      <div className="relative flex min-h-[22rem] flex-col justify-between p-5 text-white sm:min-h-[24rem]">
        <div className="flex flex-wrap gap-2">
          <span className="rounded-full bg-white/16 px-3 py-1.5 text-xs font-bold uppercase tracking-[0.16em] backdrop-blur-md">
            {priority ? "Start here" : event.kicker}
          </span>
          <span className="rounded-full bg-white/16 px-3 py-1.5 text-xs font-bold backdrop-blur-md">
            {event.dateLabel} at {event.timeLabel}
          </span>
        </div>
        <div>
          <p className="mb-3 inline-flex items-center gap-1.5 rounded-full bg-white/14 px-3 py-1.5 text-sm font-semibold backdrop-blur-md">
            <MapPin aria-hidden="true" className="size-4" />
            {event.venue.name}
          </p>
          <h2 className="font-display text-3xl font-semibold leading-none tracking-[-0.05em] sm:text-4xl">{event.event.title}</h2>
          <div className="mt-4 flex flex-wrap gap-2">
            <span className="rounded-full bg-white px-3 py-1.5 text-sm font-bold text-stone-950">{event.priceLabel}</span>
            <span className="rounded-full bg-white/16 px-3 py-1.5 text-sm font-bold backdrop-blur-md">
              {event.neighborhood}
            </span>
          </div>
        </div>
      </div>
    </Link>
  );
}

function FeaturedEvent({ event }: { event: TodayEventItem }) {
  return (
    <motion.article
      initial={{ opacity: 0, y: 18 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
      className="group relative min-h-[34rem] overflow-hidden rounded-[2.25rem] border border-border/70 bg-card shadow-float"
    >
      {event.heroImage ? (
        <img
          src={event.heroImage.cdnUrl}
          alt={event.heroImage.altText ?? ""}
          className="absolute inset-0 h-full w-full object-cover transition duration-700 group-hover:scale-[1.03]"
        />
      ) : null}
      <div className={cn("absolute inset-0 bg-gradient-to-br", accentClasses[event.accent])} />
      <div className="absolute inset-0 bg-gradient-to-t from-black/82 via-black/28 to-black/10" />

      <div className="relative flex min-h-[34rem] flex-col justify-between p-6 text-white sm:p-8 lg:p-10">
        <div className="flex flex-wrap items-center gap-3">
          <span className="inline-flex items-center gap-2 rounded-full bg-white/16 px-4 py-2 text-sm font-semibold backdrop-blur-md">
            <Sparkles aria-hidden="true" className="size-4" />
            {event.kicker}
          </span>
          <span className="rounded-full bg-white/16 px-4 py-2 text-sm font-semibold backdrop-blur-md">
            {event.dateLabel} at {event.timeLabel}
          </span>
        </div>

        <div className="max-w-3xl">
          <p className="mb-4 inline-flex items-center gap-2 rounded-full bg-white/14 px-4 py-2 text-sm font-semibold backdrop-blur-md">
            <MapPin aria-hidden="true" className="size-4" />
            {event.venue.name} · {event.neighborhood}
          </p>
          <h1 className="font-display text-5xl font-semibold leading-[0.92] tracking-[-0.06em] sm:text-7xl">
            {event.event.title}
          </h1>
          <p className="mt-5 max-w-2xl text-lg leading-8 text-white/82">{event.event.descriptionText}</p>
          <div className="mt-7 flex flex-wrap gap-3">
            <Link
              to="/event/$slug"
              params={{ slug: event.event.slug }}
              className="inline-flex items-center gap-2 rounded-full bg-white px-5 py-3 text-sm font-bold text-stone-950 transition hover:bg-white/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
            >
              View details
            </Link>
            {event.event.ticketUrl ? (
              <a
                href={event.event.ticketUrl}
                className="inline-flex items-center gap-2 rounded-full border border-white/30 bg-white/12 px-5 py-3 text-sm font-bold text-white backdrop-blur-md transition hover:bg-white/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
              >
                <Ticket aria-hidden="true" className="size-4" />
                Tickets
              </a>
            ) : null}
          </div>
        </div>
      </div>
    </motion.article>
  );
}

function DiscoveryPanel({
  events,
  source,
  generatedAt
}: {
  events: TodayEventItem[];
  source: "api" | "mock";
  generatedAt: string;
}) {
  const tonightCount = events.filter((event) => isTonight(event.event.startTs)).length;
  const freeCount = events.filter((event) => event.event.isFree).length;
  const categories = [...new Set(events.map((event) => event.event.category))].slice(0, 4);

  return (
    <motion.aside
      initial={{ opacity: 0, y: 18 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.08, ease: [0.22, 1, 0.36, 1] }}
      className="relative overflow-hidden rounded-[2.25rem] border border-border/70 bg-card p-6 shadow-soft sm:p-8"
    >
      <div className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_top,var(--color-gold-haze),transparent_26rem)] opacity-35" />
      <p className="text-sm font-semibold uppercase tracking-[0.3em] text-accent">Today / Fresno</p>
      <h2 className="mt-5 font-display text-4xl font-semibold leading-none tracking-[-0.045em] text-foreground">
        A calmer way to choose your night.
      </h2>
      <p className="mt-4 text-sm leading-7 text-muted-foreground">
        Start with one great recommendation, then scan what is close, free, family-friendly, or worth planning around.
      </p>

      <div className="mt-7 grid grid-cols-2 gap-3">
        <Metric label="Events" value={events.length.toString()} />
        <Metric label="Tonight" value={tonightCount.toString()} />
        <Metric label="Free" value={freeCount.toString()} />
        <Metric label="Source" value={source === "api" ? "API" : "Mock"} />
      </div>

      <div className="mt-7">
        <p className="text-xs font-semibold uppercase tracking-[0.25em] text-muted-foreground">Trending lanes</p>
        <div className="mt-3 flex flex-wrap gap-2">
          {categories.map((category) => (
            <span key={category} className="rounded-full bg-muted px-3 py-1.5 text-sm font-medium text-foreground">
              {category.replace("_", " ")}
            </span>
          ))}
        </div>
      </div>

      <p className="mt-7 text-xs text-muted-foreground">Updated {formatRelativeTime(generatedAt)}</p>
    </motion.aside>
  );
}

function EventDayGroup({ dateLabel, events }: { dateLabel: string; events: TodayEventItem[] }) {
  return (
    <section className="rounded-[1.75rem] border border-border/70 bg-card/72 p-3 shadow-soft">
      <div className="flex items-center gap-2 px-3 py-2">
        <CalendarDays aria-hidden="true" className="size-4 text-accent" />
        <h3 className="text-sm font-bold uppercase tracking-[0.24em] text-muted-foreground">{dateLabel}</h3>
      </div>
      <div className="grid gap-3">
        {events.map((event) => (
          <EventRow key={event.event.id} event={event} />
        ))}
      </div>
    </section>
  );
}

function EventRow({ event }: { event: TodayEventItem }) {
  return (
    <Link
      to="/event/$slug"
      params={{ slug: event.event.slug }}
      className="group grid gap-4 rounded-[1.35rem] bg-background/70 p-3 outline-none transition hover:bg-background focus-visible:ring-2 focus-visible:ring-ring sm:grid-cols-[9rem_minmax(0,1fr)_auto]"
    >
      <div className="relative min-h-32 overflow-hidden rounded-[1.1rem] bg-muted sm:min-h-0">
        {event.heroImage ? (
          <img
            src={event.heroImage.cdnUrl}
            alt={event.heroImage.altText ?? ""}
            className="h-full w-full object-cover transition duration-500 group-hover:scale-105"
          />
        ) : null}
        <div className={cn("absolute inset-0 bg-gradient-to-br opacity-80", accentClasses[event.accent])} />
      </div>

      <div className="min-w-0 py-1">
        <div className="flex flex-wrap items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-accent">
          <span>{event.kicker}</span>
          <span aria-hidden="true">·</span>
          <span>{event.event.category.replace("_", " ")}</span>
        </div>
        <h4 className="mt-2 font-display text-2xl font-semibold tracking-[-0.035em] text-foreground">
          {event.event.title}
        </h4>
        <p className="mt-2 line-clamp-2 text-sm leading-6 text-muted-foreground">{event.event.descriptionText}</p>
        <div className="mt-4 flex flex-wrap gap-x-4 gap-y-2 text-sm font-medium text-muted-foreground">
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
        <span className="rounded-full bg-muted px-3 py-1.5 text-sm font-bold text-foreground">{event.priceLabel}</span>
        <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-muted-foreground">
          <Star aria-hidden="true" className="size-4 text-accent" />
          {event.saveCount}
        </span>
      </div>
    </Link>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-3xl border border-border/70 bg-background/65 p-4">
      <p className="font-display text-3xl font-semibold tracking-[-0.05em] text-foreground">{value}</p>
      <p className="mt-1 text-xs font-semibold uppercase tracking-[0.22em] text-muted-foreground">{label}</p>
    </div>
  );
}

function TodayLoading() {
  return (
    <section className="grid min-h-[28rem] place-items-center rounded-[2rem] border border-border/70 bg-card p-8 shadow-soft">
      <div className="flex flex-col items-center text-center">
        <Loader2 aria-hidden="true" className="size-8 animate-spin text-accent" />
        <h1 className="mt-5 font-display text-4xl font-semibold tracking-[-0.05em] text-foreground">
          Gathering tonight's picks
        </h1>
        <p className="mt-3 max-w-md text-sm leading-6 text-muted-foreground">
          Checking the first event feed and preparing the Fresno discovery surface.
        </p>
      </div>
    </section>
  );
}

function TodayEmpty() {
  return (
    <section className="rounded-[2rem] border border-border/70 bg-card p-8 text-center shadow-soft sm:p-12">
      <p className="text-sm font-semibold uppercase tracking-[0.3em] text-accent">No events yet</p>
      <h1 className="mt-4 font-display text-5xl font-semibold tracking-[-0.055em] text-foreground">
        The calendar is warming up.
      </h1>
      <p className="mx-auto mt-4 max-w-xl text-sm leading-7 text-muted-foreground">
        Once Supabase has scheduled events, this page will fill with the same cards and filters used by the mock slice.
      </p>
    </section>
  );
}

function groupByDate(events: TodayEventItem[]) {
  const groups = new Map<string, TodayEventItem[]>();

  for (const event of events) {
    groups.set(event.dateLabel, [...(groups.get(event.dateLabel) ?? []), event]);
  }

  return [...groups.entries()].map(([dateLabel, items]) => ({ dateLabel, items }));
}

function isTonight(value: string) {
  const eventDate = new Date(value);
  const now = new Date();
  return eventDate.toDateString() === now.toDateString() && eventDate.getHours() >= 17;
}

function formatRelativeTime(value: string) {
  const date = new Date(value);
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit"
  }).format(date);
}
