import { Link } from "@tanstack/react-router";
import { ExternalLink, Heart, Loader2 } from "lucide-react";

import { AdSlot } from "@/components/AdSlot";
import { EventRow } from "@/components/EventRow";
import { PlaceholderImage } from "@/components/PlaceholderImage";
import { SecHead } from "@/components/SecHead";
import { SeeAllDayCta } from "@/components/SeeAllDayCta";
import { FooterStamp } from "@/components/FooterStamp";
import { StickyCtaBar } from "@/components/StickyCtaBar";
import { ContextStrip } from "@/components/ContextStrip";
import { AdminEditLink } from "@/features/admin-mode/AdminEditLink";
import { deriveTagline, formatPrice, toEventRowViewModel } from "@/lib/event-view-model";
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
  const whatToKnow = event.tags.length > 0 ? event.tags : null;

  const relatedRows = detail.relatedEvents.map((item) => toEventRowViewModel(item));
  const seriesRows = (detail.seriesEvents ?? []).map((item) => toEventRowViewModel(item));

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
            <div className={styles.heroActions}>
              {event.ticketUrl ? (
                <a href={event.ticketUrl} target="_blank" rel="noreferrer" className={styles.primaryBtn}>
                  RSVP / TICKETS <ExternalLink size={14} />
                </a>
              ) : (
                <span className={styles.primaryBtn}>RSVP</span>
              )}
              <button type="button" className={styles.saveBtn}>
                <Heart size={16} /> SAVE
              </button>
            </div>
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
          <span className={styles.val}>{venue.name}</span>
          <span className={styles.sub}>{venue.neighborhood ?? venue.city}</span>
        </div>
        <div className={styles.fact}>
          <span className={styles.lab}>Price</span>
          <span className={`${styles.val} ${event.isFree ? styles.olive : styles.coral}`}>{formatPrice(event)}</span>
        </div>
        <div className={styles.fact}>
          <span className={styles.lab}>Crowd</span>
          <span className={styles.val}>All ages</span>
          <span className={styles.sub}>Family-friendly vibe</span>
        </div>
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
            <div className={styles.map}>
              <div className={styles.road} />
              <div className={styles.road2} />
              <div className={styles.pin}>
                <div className={styles.pinBody} />
              </div>
              <span className={styles.mapLabel}>{venue.name}</span>
            </div>
            <p>
              {[venue.address, venue.city].filter(Boolean).join(", ") || venue.city}
            </p>
            {venue.website ? (
              <a href={venue.website} target="_blank" rel="noreferrer" className={styles.mapLink}>
                Open venue website →
              </a>
            ) : null}
          </section>

          {whatToKnow ? (
            <section className={styles.sec}>
              <SecHead number="04" script="good to know" title="WHAT TO KNOW" />
              <ul>
                {whatToKnow.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </section>
          ) : null}

          <section className={styles.sec}>
            <SecHead number="05" script="source" title="ORIGINAL SOURCE" />
            <div className={styles.sourceBox}>
              <span className={styles.sourceTag}>{event.source}</span>
              <p>{event.externalUrl ? <a href={event.externalUrl}>{event.externalUrl}</a> : "Ingested via What Up Fresno"}</p>
            </div>
          </section>

          {seriesRows.length > 0 ? (
            <section className={styles.sec}>
              <SecHead
                number="06"
                script="same series"
                title="MORE IN THIS SERIES"
                count={seriesRows.length}
              />
              <div className={styles.relatedList}>
                {seriesRows.map((row) => (
                  <EventRow key={row.id} event={row} slug={row.slug} />
                ))}
              </div>
            </section>
          ) : null}

          <section className={styles.sec}>
            <SecHead
              number={seriesRows.length > 0 ? "07" : "06"}
              script="same day"
              title="OTHER EVENTS THIS DAY"
              count={relatedRows.length}
            />
            <div className={styles.relatedList}>
              {relatedRows.map((row) => (
                <EventRow key={row.id} event={row} slug={row.slug} />
              ))}
            </div>
            <SeeAllDayCta date={dayIso} count={relatedRows.length + 1} />
          </section>
        </div>

        <aside className={styles.sideCol}>
          <div className={styles.sideCard}>
            <h3>ORGANIZER</h3>
            <div className={styles.organizer}>
              <div className={styles.avatar} style={{ background: gradientForPalette(paletteKey) }} />
              <div>
                <p className={styles.orgName}>{venue.name}</p>
                <p className={styles.orgMeta}>{venue.neighborhood ?? venue.city}</p>
              </div>
            </div>
            <div className={styles.shareRow}>
              <button type="button">FOLLOW</button>
              <button type="button">CONTACT</button>
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
          <div className={`${styles.sideCard} ${styles.postcard}`}>
            <h3>POSTCARD</h3>
            <p className={styles.postcardScript}>greetings from the central valley</p>
            <p>Share this event with friends across Fresno.</p>
          </div>
          <AdSlot variant="side" />
        </aside>
      </div>

      <FooterStamp />
      <StickyCtaBar ticketUrl={event.ticketUrl ?? null} />
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
