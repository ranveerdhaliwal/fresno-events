import { Link } from "@tanstack/react-router";
import { ArrowLeft, CalendarDays, Clock3, ExternalLink, Loader2, MapPin, Ticket } from "lucide-react";

import type { ImageAsset } from "@fresno-events/shared";

import { useEventDetail } from "./use-event-queries";

const timeZone = "America/Los_Angeles";

export function EventDetailPage({ slug }: { slug: string }) {
  const { data, isLoading, isError, refetch } = useEventDetail(slug);

  if (isLoading) {
    return <DetailLoading />;
  }

  if (isError || !data) {
    return (
      <section className="rounded-[2rem] border border-border/70 bg-card p-8 shadow-soft">
        <Link
          to="/calendar"
          className="inline-flex min-h-11 items-center gap-2 rounded-full border border-border px-4 text-sm font-bold text-foreground transition hover:border-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <ArrowLeft aria-hidden="true" className="size-4" />
          Back to calendar
        </Link>
        <h1 className="mt-8 font-display text-4xl font-semibold tracking-[-0.052em] text-foreground sm:text-5xl">
          This event is not available.
        </h1>
        <p className="mt-3 max-w-xl text-sm leading-6 text-muted-foreground">
          The listing may have moved, expired, or failed to load. Try again or browse the week.
        </p>
        <button
          type="button"
          onClick={() => void refetch()}
          className="mt-5 inline-flex min-h-11 items-center rounded-full bg-primary px-4 text-sm font-bold text-primary-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          Retry
        </button>
      </section>
    );
  }

  const { detail, item } = data;
  const images = detail.galleryImages.length > 0 ? detail.galleryImages : detail.heroImage ? [detail.heroImage] : [];

  return (
    <article className="space-y-7 pb-2 md:pb-0">
      <Link
        to="/calendar"
        className="inline-flex min-h-11 items-center gap-2 rounded-full border border-border bg-card px-4 text-sm font-bold text-foreground transition hover:border-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <ArrowLeft aria-hidden="true" className="size-4" />
        Back to calendar
      </Link>

      <section className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="overflow-hidden rounded-[2rem] border border-border/70 bg-card shadow-float">
          <ImageStage images={images} title={detail.event.title} />
          <div className="p-5 sm:p-7">
            <div className="flex flex-wrap gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-accent">
              <span>{item.kicker}</span>
              <span>{detail.event.category.replace("_", " ")}</span>
              <span>{detail.event.status.replace("_", " ")}</span>
            </div>
            <h1 className="mt-3 max-w-4xl font-display text-4xl font-semibold leading-none tracking-[-0.052em] text-foreground sm:text-6xl">
              {detail.event.title}
            </h1>
            <p className="mt-5 max-w-3xl text-base leading-8 text-muted-foreground">
              {detail.event.descriptionText ?? "Details are still being reviewed for this event."}
            </p>
          </div>
        </div>

        <aside className="h-fit space-y-4 rounded-[2rem] border border-border/70 bg-card p-5 shadow-soft">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-muted-foreground">When</p>
            <div className="mt-3 space-y-2 text-sm font-medium text-foreground">
              <p className="flex items-center gap-2">
                <CalendarDays aria-hidden="true" className="size-4 text-accent" />
                {formatDate(detail.event.startTs)}
              </p>
              <p className="flex items-center gap-2">
                <Clock3 aria-hidden="true" className="size-4 text-accent" />
                {formatTimeRange(detail.event.startTs, detail.event.endTs)}
              </p>
            </div>
          </div>

          <div className="border-t border-border/70 pt-4">
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-muted-foreground">Where</p>
            <p className="mt-3 font-display text-2xl font-semibold tracking-[-0.035em] text-foreground">
              {detail.venue.name}
            </p>
            <p className="mt-1 text-sm leading-6 text-muted-foreground">
              {[detail.venue.address, detail.venue.city].filter(Boolean).join(", ") || detail.venue.city}
            </p>
          </div>

          <div className="border-t border-border/70 pt-4">
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-muted-foreground">Price</p>
            <p className="mt-2 text-sm font-bold text-foreground">{item.priceLabel}</p>
          </div>

          <div className="space-y-2 border-t border-border/70 pt-4">
            {detail.event.ticketUrl ? (
              <a
                href={detail.event.ticketUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-full bg-primary px-5 text-sm font-bold text-primary-foreground transition hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <Ticket aria-hidden="true" className="size-4" />
                Tickets
              </a>
            ) : null}
            {detail.event.externalUrl ? (
              <a
                href={detail.event.externalUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-full border border-border bg-background px-5 text-sm font-bold text-foreground transition hover:border-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                More details
                <ExternalLink aria-hidden="true" className="size-4" />
              </a>
            ) : null}
          </div>

          <p className="border-t border-border/70 pt-4 text-xs leading-5 text-muted-foreground">
            Source: {detail.event.source}. Last seen {detail.event.lastSeenAt ? formatShortDate(detail.event.lastSeenAt) : "pending review"}.
          </p>
        </aside>
      </section>

      {detail.event.tags.length > 0 ? (
        <section className="flex flex-wrap gap-2">
          {detail.event.tags.map((tag) => (
            <span key={tag} className="rounded-full bg-muted px-3 py-1.5 text-sm font-semibold text-foreground">
              {tag}
            </span>
          ))}
        </section>
      ) : null}

      {detail.relatedEvents.length > 0 ? (
        <section className="rounded-[1.75rem] border border-border/70 bg-card p-5">
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-accent">Nearby in the feed</p>
          <div className="mt-4 grid gap-3 md:grid-cols-3">
            {detail.relatedEvents.map((related) => (
              <Link
                key={related.event.id}
                to="/event/$slug"
                params={{ slug: related.event.slug }}
                className="rounded-[1.25rem] bg-background p-4 outline-none transition hover:bg-muted/70 focus-visible:ring-2 focus-visible:ring-ring"
              >
                <p className="text-sm font-semibold text-muted-foreground">{related.venue.name}</p>
                <h2 className="mt-2 font-display text-2xl font-semibold tracking-[-0.035em] text-foreground">
                  {related.event.title}
                </h2>
              </Link>
            ))}
          </div>
        </section>
      ) : null}
    </article>
  );
}

function ImageStage({ images, title }: { images: ImageAsset[]; title: string }) {
  if (images.length === 0) {
    return (
      <div className="grid min-h-[20rem] place-items-center bg-muted p-8 text-center">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.26em] text-accent">What Up Fresno</p>
          <p className="mt-3 font-display text-3xl font-semibold tracking-[-0.04em] text-foreground">
            Image coming soon
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="grid gap-2 bg-muted p-2 sm:grid-cols-[minmax(0,1fr)_8rem]">
      <img src={images[0]?.cdnUrl} alt={images[0]?.altText ?? title} className="h-[18rem] w-full rounded-[1.45rem] object-cover sm:h-[24rem]" />
      <div className="hidden gap-2 sm:grid">
        {images.slice(1, 4).map((image) => (
          <img key={image.id} src={image.cdnUrl} alt={image.altText ?? title} className="h-full min-h-0 rounded-[1rem] object-cover" />
        ))}
      </div>
    </div>
  );
}

function DetailLoading() {
  return (
    <div className="grid min-h-[32rem] place-items-center rounded-[2rem] border border-border/70 bg-card">
      <div className="text-center">
        <Loader2 aria-hidden="true" className="mx-auto size-8 animate-spin text-accent" />
        <p className="mt-3 text-sm font-semibold text-muted-foreground">Loading event details</p>
      </div>
    </div>
  );
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    timeZone
  }).format(new Date(value));
}

function formatShortDate(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    timeZone
  }).format(new Date(value));
}

function formatTimeRange(start: string, end?: string) {
  const startLabel = formatTime(start);
  return end ? `${startLabel} to ${formatTime(end)}` : startLabel;
}

function formatTime(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
    timeZone
  }).format(new Date(value));
}
