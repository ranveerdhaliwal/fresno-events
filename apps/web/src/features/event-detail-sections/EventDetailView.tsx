import { Link } from "@tanstack/react-router";
import { ExternalLink, Loader2 } from "lucide-react";

import { AdSlot } from "@/components/AdSlot";
import { EventRow } from "@/components/EventRow";
import { PlaceholderImage } from "@/components/PlaceholderImage";
import { SecHead } from "@/components/SecHead";
import { SeeAllDayCta } from "@/components/SeeAllDayCta";
import { ContextStrip } from "@/components/ContextStrip";
import { AdminEditLink } from "@/features/admin-mode/AdminEditLink";
import { EventShareCard } from "@/components/EventShareCard";
import { VenueMiniMap } from "@/components/VenueMiniMap";
import { deriveTagline, formatPrice, toEventRowViewModel } from "@/lib/event-view-model";
import { formatVenueAddressLine } from "@/lib/venue-display.utils";
import { buildGoogleMapsSearchUrl } from "@fresno-events/shared";
import { resolveMediaUrl } from "@/lib/media-url";
import { formatCountdownLabel, formatEventDate, formatShortTime, toIsoDateLocal } from "@/lib/event-time";
import { paletteKeyForCategory, gradientForPalette } from "@/lib/image-palette";
import type { EventDetailResult } from "@/services/events.types";

import styles from "./EventDetailView.module.css";

export function EventDetailView({ data }: { data: EventDetailResult }) {
  const { detail } = data;
  const { event, venue, heroImage } = detail;
  const paletteKey = paletteKeyForCategory(event.category, event.id);
  const imageUrl = resolveMediaUrl(heroImage?.cdnUrl ?? null);
  const tagline = deriveTagline(event);
  const dayIso = toIsoDateLocal(new Date(event.startTs));

  const relatedRows = detail.relatedEvents.map((item) => toEventRowViewModel(item));
  const seriesRows = (detail.seriesEvents ?? []).map((item) => toEventRowViewModel(item));
  const mapsUrl = buildGoogleMapsSearchUrl({
    ...(venue.address ? { address: venue.address } : {}),
    city: venue.city,
    ...(venue.lat != null ? { lat: venue.lat } : {}),
    ...(venue.lng != null ? { lng: venue.lng } : {})
  });
  const hasCoords = venue.lat != null && venue.lng != null;
  const priceLabel = formatPrice(event);
  const originalUrl = event.externalUrl ?? event.ticketUrl ?? null;
  const shareUrl = typeof globalThis.location !== "undefined" ? globalThis.location.href : "";

  return (
    <article className={styles.article} data-testid="event-detail-view">
      <div className={styles.crumbs}>
        <Link to="/">Home</Link>
        <span className={styles.sep}>/</span>
        <Link to="/day/$date" params={{ date: dayIso }}>
          {formatEventDate(event.startTs)}
        </Link>
        <span className={styles.sep}>/</span>
        <span className={styles.current}>{event.title}</span>
        <Link to="/day/$date" params={{ date: dayIso }} className={styles.back}>
          ← BACK TO DAY
        </Link>
      </div>

      <div className={styles.heroWrap}>
        <div className={styles.hero}>
          <PlaceholderImage paletteKey={paletteKey} label={event.category.replace("_", " ")} imageUrl={imageUrl} />
          <div className={styles.heroOverlay} />
          <div className={styles.heroContent}>
            <div className={styles.heroText}>
              <div className={styles.heroPills}>
                {event.priority <= 1 ? <span className={styles.pill}>HUGE</span> : null}
                <span className={styles.pillMustard}>{event.category.replace("_", " ")}</span>
                <AdminEditLink eventId={event.id} />
              </div>
              <h1>{event.title}</h1>
              {event.seriesName ? <p className={styles.seriesSubtitle}>{event.seriesName}</p> : null}
              <p className={styles.tagline}>{tagline}</p>
            </div>
            {event.ticketUrl ? (
              <div className={styles.heroActions}>
                <a href={event.ticketUrl} target="_blank" rel="noreferrer" className={styles.primaryBtn}>
                  TICKETS <ExternalLink size={14} />
                </a>
              </div>
            ) : null}
          </div>
        </div>
      </div>

      <ContextStrip dayIso={dayIso} countdown={formatCountdownLabel(event.startTs)} />

      <div className={styles.quickFacts}>
        <div className={styles.fact}>
          <span className={styles.lab}>When</span>
          <span className={styles.val}>{formatEventDate(event.startTs)}</span>
          <span className={styles.sub}>{formatShortTime(event.startTs)}</span>
        </div>
        <div className={styles.fact}>
          <span className={styles.lab}>Where</span>
          <span className={styles.val}>
            {venue.slug ? (
              <Link to="/venue/$slug" params={{ slug: venue.slug }} className={styles.venueLink}>
                {venue.name}
              </Link>
            ) : (
              venue.name
            )}
          </span>
          <span className={styles.sub}>{venue.neighborhood ?? venue.city}</span>
        </div>
        {priceLabel ? (
          <div className={styles.fact}>
            <span className={styles.lab}>Price</span>
            <span className={`${styles.val} ${event.isFree ? styles.olive : styles.coral}`}>{priceLabel}</span>
          </div>
        ) : null}
      </div>

      <div className={styles.content}>
        <div className={styles.mainCol}>
          <section className={styles.sec}>
            <SecHead number="01" script="the story" title="ABOUT" />
            <p>{event.descriptionText ?? "Details are still being confirmed for this event."}</p>
          </section>

          {event.lineup && event.lineup.length > 0 ? (
            <section className={styles.sec}>
              <SecHead number="02" script="who's playing" title="LINEUP" />
              <div className={styles.lineup}>
                {event.lineup.map((entry, index) => (
                  <div key={`${entry.name}-${index}`} className={styles.act}>
                    <p className={styles.who}>{entry.name}</p>
                    {entry.time ? <p className={styles.when}>{entry.time}</p> : null}
                    {entry.stage ? <p className={styles.where}>{entry.stage}</p> : null}
                  </div>
                ))}
              </div>
            </section>
          ) : null}

          <section className={styles.sec}>
            <SecHead number="03" script="find it" title="LOCATION & PARKING" />
            {hasCoords ? (
              <VenueMiniMap
                lat={venue.lat!}
                lng={venue.lng!}
                category={event.category}
                title={event.title}
                tags={event.tags}
                subcategories={event.subcategories}
                {...(event.mapPinEmoji != null ? { mapPinEmoji: event.mapPinEmoji } : {})}
              />
            ) : null}
            <p className={styles.addressLine}>{formatVenueAddressLine(venue) || venue.name}</p>
            {mapsUrl ? (
              <a href={mapsUrl} target="_blank" rel="noreferrer" className={styles.mapLink}>
                Open in Google Maps →
              </a>
            ) : null}
          </section>

          <section className={styles.sec}>
            <SecHead number="04" script="the" title="ORIGINAL LINK" />
            <div className={styles.sourceBox}>
              {originalUrl ? (
                <a href={originalUrl} target="_blank" rel="noreferrer" className={styles.sourceLink}>
                  View original listing <ExternalLink size={14} aria-hidden />
                </a>
              ) : (
                <p className={styles.sourceMissing}>No external listing link on file yet.</p>
              )}
              {venue.website ? (
                <a href={venue.website} target="_blank" rel="noreferrer" className={styles.sourceLink}>
                  Venue website <ExternalLink size={14} aria-hidden />
                </a>
              ) : null}
            </div>
          </section>

          {seriesRows.length > 0 ? (
            <section className={styles.sec}>
              <SecHead
                number="05"
                script="same series"
                title="MORE IN THIS SERIES"
                count={seriesRows.length}
              />
              {event.seriesId ? (
                <Link
                  to="/series/$seriesId"
                  params={{ seriesId: event.seriesId }}
                  className={styles.seriesAllLink}
                >
                  See all dates →
                </Link>
              ) : null}
              <div className={styles.relatedList}>
                {seriesRows.map((row) => (
                  <EventRow key={row.id} event={row} slug={row.slug} adminAction={<AdminEditLink eventId={row.id} />} />
                ))}
              </div>
            </section>
          ) : null}

          <section className={styles.sec}>
            <SecHead
              number={seriesRows.length > 0 ? "06" : "05"}
              script="same day"
              title="OTHER EVENTS THIS DAY"
              count={relatedRows.length}
            />
            <div className={styles.relatedList}>
              {relatedRows.map((row) => (
                <EventRow key={row.id} event={row} slug={row.slug} adminAction={<AdminEditLink eventId={row.id} />} />
              ))}
            </div>
            <SeeAllDayCta date={dayIso} count={relatedRows.length + 1} />
          </section>
        </div>

        <aside className={styles.sideCol}>
          <div className={styles.sideCard}>
            <h3>VENUE</h3>
            <div className={styles.organizer}>
              <div className={styles.avatar} style={{ background: gradientForPalette(paletteKey) }} />
              <div>
                {venue.slug ? (
                  <Link to="/venue/$slug" params={{ slug: venue.slug }} className={styles.orgName}>
                    {venue.name}
                  </Link>
                ) : (
                  <p className={styles.orgName}>{venue.name}</p>
                )}
                <p className={styles.orgMeta}>{venue.neighborhood ?? venue.city}</p>
                <p className={styles.orgAddress}>{formatVenueAddressLine(venue)}</p>
              </div>
            </div>
          </div>
          <div className={styles.sideCard}>
            <h3>TAGS</h3>
            <div className={styles.tags}>
              {event.tags.map((tag) => (
                <span key={tag}>{tag}</span>
              ))}
            </div>
          </div>
          <EventShareCard title={event.title} url={shareUrl} />
          <AdSlot variant="side" />
        </aside>
      </div>
    </article>
  );
}

export function EventDetailLoading() {
  return (
    <div className={styles.loading}>
      <Loader2 className={styles.spin} size={32} />
      <p>Loading event…</p>
    </div>
  );
}

export function EventDetailError({ onRetry }: { onRetry: () => void }) {
  return (
    <div className={styles.error}>
      <h1>Event not available</h1>
      <p>This listing may have moved or failed to load.</p>
      <button type="button" onClick={onRetry}>
        Retry
      </button>
      <Link to="/">← Back home</Link>
    </div>
  );
}
