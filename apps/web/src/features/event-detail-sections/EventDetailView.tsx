import { Link } from "@tanstack/react-router";
import { ExternalLink } from "lucide-react";

import { AdSlot } from "@/components/AdSlot";
import { Button } from "@/components/Button/Button";
import { EventShareCard } from "@/components/EventShareCard";
import { EventTag } from "@/components/EventTag";
import { PlaceholderImage } from "@/components/PlaceholderImage";
import { SecHead } from "@/components/SecHead";
import { SeeAllDayCta } from "@/components/SeeAllDayCta";
import { SelectableEventRow } from "@/components/SelectableEventRow";
import { Text } from "@/components/Text";
import { ContextStrip } from "@/components/ContextStrip";
import { AdminEditLink } from "@/features/admin-mode/AdminEditLink";
import { VenueMiniMap } from "@/components/VenueMiniMap";
import { ActiveEndedEventList } from "@/features/event-browse/ActiveEndedEventList";
import { useIsMobile } from "@/hooks/useIsMobile";
import { deriveTagline, eventIsFree, formatDetailPrice, toEventRowViewModel } from "@/lib/event-view-model";
import { heroImageFit, heroImagePadding } from "@/lib/hero-image.utils";
import { formatVenueAddressLine } from "@/lib/venue-display.utils";
import { resolvePublicEventTags } from "@/lib/public-event-tags.utils";
import { buildEventIntroSentence, buildGoogleMapsSearchUrl, formatCategoryLabel, stripVenueCountrySuffix } from "@fresno-events/shared";
import { resolveMediaUrl } from "@/lib/media-url";
import { formatCountdownLabel, formatEventDate, formatShortTime, toIsoDateLocal } from "@/lib/event-time";
import { paletteKeyForCategory } from "@/lib/image-palette";
import type { EventDetailResult } from "@/services/events.types";

import styles from "./EventDetailView.module.css";
import { EventDetailSkeleton } from "./EventDetailSkeleton";

export function EventDetailView({ data }: { data: EventDetailResult }) {
  const isMobile = useIsMobile();
  const { detail } = data;
  const { event, venue, heroImage } = detail;
  const paletteKey = paletteKeyForCategory(event.category, event.id);
  const imageUrl = resolveMediaUrl(heroImage?.cdnUrl ?? null);
  const tagline = deriveTagline(event);
  const publicTags = resolvePublicEventTags({ tags: event.tags, subcategories: event.subcategories });
  const dayIso = toIsoDateLocal(new Date(event.startTs));
  const logoPadding = heroImagePadding(imageUrl);

  const relatedRows = detail.relatedEvents.map((item) => toEventRowViewModel(item));
  const seriesRows = (detail.seriesEvents ?? []).map((item) => toEventRowViewModel(item));
  const mapsUrl = buildGoogleMapsSearchUrl({
    ...(venue.address ? { address: venue.address } : {}),
    city: venue.city,
    ...(venue.lat != null ? { lat: venue.lat } : {}),
    ...(venue.lng != null ? { lng: venue.lng } : {})
  });
  const hasCoords = venue.lat != null && venue.lng != null;
  const priceLabel = formatDetailPrice(event) || "TBA";
  const categoryLabel = formatCategoryLabel(event.category);
  const ticketUrl = event.ticketUrl?.trim() || null;
  const sourceUrl = event.externalUrl?.trim() || null;
  const originalUrl = sourceUrl ?? ticketUrl;
  const venueDisplayName = stripVenueCountrySuffix(venue.name);
  const shareUrl = typeof globalThis.location !== "undefined" ? globalThis.location.href : "";
  const heroAlt = heroImage?.altText?.trim() || `${event.title} at ${venueDisplayName}`;
  const seoIntro = buildEventIntroSentence(event, venue);

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
        {!isMobile ? (
          <Button
            to="/day/$date"
            params={{ date: dayIso }}
            variant="mustard"
            size="sm"
            className={styles.back}
          >
            ← All events on {formatEventDate(event.startTs)}
          </Button>
        ) : null}
      </div>

      <div className={styles.heroWrap}>
        <div className={styles.hero}>
          <PlaceholderImage
            paletteKey={paletteKey}
            label={categoryLabel}
            imageUrl={imageUrl}
            alt={heroAlt}
            imageFit={heroImageFit(imageUrl)}
            {...(logoPadding !== undefined ? { imagePadding: logoPadding } : {})}
          />
          <div className={styles.heroOverlay} />
          <div className={styles.heroContent}>
            <div className={styles.heroText}>
              <div className={styles.heroPills}>
                <Text variant="eyebrow" tone="onPage" as="span" className={styles.pillMustard}>
                  {categoryLabel}
                </Text>
                <AdminEditLink eventId={event.id} />
              </div>
              <Text variant="header1" tone="inverse" as="h1" className={styles.heroTitle}>
                {event.title}
              </Text>
              {event.seriesName ? (
                <Text variant="body2" tone="inverse" as="p" className={styles.seriesSubtitle}>
                  {event.seriesName}
                </Text>
              ) : null}
              <Text variant="body1" tone="brand" weight="semibold" as="p" className={styles.tagline}>
                {tagline}
              </Text>
            </div>
            {ticketUrl || sourceUrl ? (
              <div className={styles.heroActions}>
                {ticketUrl ? (
                  <Button
                    href={ticketUrl}
                    target="_blank"
                    rel="noreferrer"
                    variant="cta"
                    size="sm"
                    className={styles.heroBtn}
                  >
                    TICKETS <ExternalLink size={12} aria-hidden />
                  </Button>
                ) : null}
                {sourceUrl ? (
                  <Button
                    href={sourceUrl}
                    target="_blank"
                    rel="noreferrer"
                    variant="cta"
                    size="sm"
                    className={styles.heroBtn}
                  >
                    SOURCE <ExternalLink size={12} aria-hidden />
                  </Button>
                ) : null}
              </div>
            ) : null}
          </div>
        </div>
      </div>

      <ContextStrip countdown={formatCountdownLabel(event.startTs)} />

      <div className={styles.quickFacts}>
        <div className={styles.fact}>
          <Text variant="eyebrow" tone="label" as="span" className={styles.lab}>
            When
          </Text>
          <Text variant="body1" tone="onCard" as="span" className={styles.val}>
            {formatEventDate(event.startTs)}
          </Text>
          <Text variant="body3" tone="mutedOnCard" as="span" className={styles.sub}>
            {formatShortTime(event.startTs)}
          </Text>
        </div>
        <div className={styles.fact}>
          <Text variant="eyebrow" tone="label" as="span" className={styles.lab}>
            Where
          </Text>
          <Text variant="body1" tone="onCard" weight="regular" as="span" className={styles.whereVal}>
            {venue.slug ? (
              <Link to="/venue/$slug" params={{ slug: venue.slug }} className={styles.venueLink}>
                {venueDisplayName}
              </Link>
            ) : (
              venueDisplayName
            )}
          </Text>
          <Text variant="body3" tone="mutedOnCard" as="span" className={styles.sub}>
            {venue.neighborhood ?? venue.city}
          </Text>
        </div>
        <div className={styles.fact}>
          <Text variant="eyebrow" tone="label" as="span" className={styles.lab}>
            Price
          </Text>
          <Text
            variant="body1"
            tone={eventIsFree(event) ? "label" : "accent"}
            as="span"
            className={styles.val}
          >
            {priceLabel}
          </Text>
        </div>
        <div className={styles.fact}>
          <Text variant="eyebrow" tone="label" as="span" className={styles.lab}>
            Category
          </Text>
          <Text variant="body1" tone="onCard" as="span" className={styles.val}>
            {categoryLabel}
          </Text>
        </div>
      </div>

      <div className={styles.content}>
        <div className={styles.mainCol}>
          <section className={styles.sec}>
            <SecHead script="the story" title="ABOUT" />
            <Text variant="body1" tone="onPage" as="p" className={styles.seoIntro}>
              {seoIntro}
            </Text>
            <Text variant="body1" tone="onPage" as="p" className={styles.description}>
              {event.descriptionText ?? "Details are still being confirmed for this event."}
            </Text>
          </section>

          {event.lineup && event.lineup.length > 0 ? (
            <section className={styles.sec}>
              <SecHead script="who's playing" title="LINEUP" />
              <div className={styles.lineup}>
                {event.lineup.map((entry, index) => (
                  <div key={`${entry.name}-${index}`} className={styles.act}>
                    <Text variant="header3" tone="onPage" as="p" className={styles.who}>
                      {entry.name}
                    </Text>
                    {entry.time ? (
                      <Text variant="body2" tone="mutedOnPage" as="p" className={styles.when}>
                        {entry.time}
                      </Text>
                    ) : null}
                    {entry.stage ? (
                      <Text variant="body3" tone="label" as="p" className={styles.where}>
                        {entry.stage}
                      </Text>
                    ) : null}
                  </div>
                ))}
              </div>
            </section>
          ) : null}

          <section className={styles.sec}>
            <SecHead script="find it" title="LOCATION & PARKING" />
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
            <Text variant="body2" tone="onPage" as="p" className={styles.addressLine}>
              {formatVenueAddressLine(venue) || venueDisplayName}
            </Text>
            {mapsUrl ? (
              <a href={mapsUrl} target="_blank" rel="noreferrer" className={styles.mapLink}>
                Open in Google Maps →
              </a>
            ) : null}
          </section>

          <section className={styles.sec}>
            <SecHead script="source" title="ORIGINAL LINK" />
            <div className={styles.sourceBox}>
              {originalUrl ? (
                <>
                  <a href={originalUrl} target="_blank" rel="noreferrer" className={styles.sourceLink}>
                    View original listing <ExternalLink size={14} aria-hidden />
                  </a>
                  <Text variant="body2" tone="mutedOnPage" as="p" className={styles.sourceNote}>
                    Check the original listing for details we may have missed here, and to confirm
                    pricing and whether the event is still on.
                  </Text>
                </>
              ) : (
                <Text variant="body2" tone="mutedOnPage" as="p" className={styles.sourceMissing}>
                  No external listing link on file yet.
                </Text>
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
              <SecHead script="same series" title="MORE IN THIS SERIES" count={seriesRows.length} />
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
                  <SelectableEventRow
                    key={row.id}
                    event={row}
                    linkRows
                    adminAction={<AdminEditLink eventId={row.id} />}
                  />
                ))}
              </div>
            </section>
          ) : null}

          <section className={styles.sec}>
            <SecHead script="same day" title="OTHER EVENTS THIS DAY" count={relatedRows.length} />
            <div className={styles.relatedList}>
              <ActiveEndedEventList
                items={detail.relatedEvents}
                dayIso={dayIso}
                linkRows
                renderAdminAction={(eventId) => <AdminEditLink eventId={eventId} />}
                emptyMessage="No other events this day."
              />
            </div>
            <SeeAllDayCta date={dayIso} count={relatedRows.length + 1} />
          </section>
        </div>

        <aside className={styles.sideCol}>
          <div className={styles.sideCard}>
            <Text variant="eyebrow" tone="labelOnCard" as="h3" className={styles.sideCardTitle}>
              VENUE
            </Text>
            <div className={styles.organizer}>
              {venue.slug ? (
                <Link to="/venue/$slug" params={{ slug: venue.slug }} className={styles.orgName}>
                  <Text variant="header3" tone="onCard" as="span">
                    {venueDisplayName}
                  </Text>
                </Link>
              ) : (
                <Text variant="header3" tone="onCard" as="p" className={styles.orgName}>
                  {venueDisplayName}
                </Text>
              )}
              <Text variant="body3" tone="mutedOnCard" as="p" className={styles.orgMeta}>
                {venue.neighborhood ?? venue.city}
              </Text>
              <Text variant="body3" tone="mutedOnCard" as="p" className={styles.orgAddress}>
                {formatVenueAddressLine(venue)}
              </Text>
            </div>
          </div>
          {publicTags.length > 0 ? (
            <div className={styles.sideCard}>
              <Text variant="eyebrow" tone="labelOnCard" as="h3" className={styles.sideCardTitle}>
                TAGS
              </Text>
              <div className={styles.tags}>
                {publicTags.map((tag) => (
                  <EventTag key={tag}>{tag}</EventTag>
                ))}
              </div>
            </div>
          ) : null}
          <EventShareCard title={event.title} url={shareUrl} />
          <AdSlot variant="side" />
        </aside>
      </div>

      <div className={styles.footerAd}>
        <AdSlot variant="banner-footer" />
      </div>
    </article>
  );
}

export function EventDetailLoading() {
  return <EventDetailSkeleton />;
}

export function EventDetailError({ onRetry }: { onRetry: () => void }) {
  return (
    <div className={styles.error}>
      <Text variant="header1" tone="onPage" as="h1">
        Event not available
      </Text>
      <Text variant="body1" tone="mutedOnPage" as="p">
        This listing may have moved or failed to load.
      </Text>
      <button type="button" onClick={onRetry}>
        Retry
      </button>
      <Link to="/">← Back home</Link>
    </div>
  );
}
