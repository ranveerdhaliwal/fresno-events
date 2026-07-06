import { Link } from "@tanstack/react-router";

import { Button } from "@/components/Button/Button";
import { PlaceholderImage } from "@/components/PlaceholderImage";
import { Text } from "@/components/Text";
import type { EventRowViewModel } from "@/lib/event-view-model";
import { heroImageFit, heroImagePadding } from "@/lib/hero-image.utils";

import styles from "./UpcomingDetailPanel.module.css";

export interface UpcomingDetailPanelProps {
  event: EventRowViewModel | null;
}

export function UpcomingDetailPanel({ event }: UpcomingDetailPanelProps) {
  if (!event) {
    return (
      <div className={styles.panel} data-testid="upcoming-detail-empty">
        <div className={styles.empty}>
          <Text variant="script" tone="accent" scriptStyle="section" className={styles.emptyScript}>
            pick one!
          </Text>
          <Text variant="eyebrow" tone="onCard" as="h3">
            SELECT AN EVENT
          </Text>
          <Text variant="body2" tone="mutedOnCard">
            Click any row on the left to preview details here.
          </Text>
        </div>
      </div>
    );
  }

  const logoPadding = heroImagePadding(event.imageUrl);

  return (
    <div className={styles.panel} data-testid="upcoming-detail-panel">
      <div className={styles.hero}>
        <PlaceholderImage
          paletteKey={event.paletteKey}
          label={event.categoryLabel}
          imageUrl={event.imageUrl}
          imageFit={heroImageFit(event.imageUrl)}
          {...(logoPadding !== undefined ? { imagePadding: logoPadding } : {})}
        />
        <div className={styles.badges}>
          {event.flagLabel ? (
            <Text variant="eyebrow" tone="inverse" as="span" className={styles.badge}>
              {event.flagLabel}
            </Text>
          ) : null}
          <Text variant="eyebrow" tone="onCard" as="span" className={styles.badgeCat}>
            {event.categoryLabel}
          </Text>
        </div>
      </div>
      <div className={styles.body}>
        <Text variant="header2" tone="onCard" as="h3" className={styles.title}>
          <Link to="/event/$slug" params={{ slug: event.slug }}>
            {event.title}
          </Link>
        </Text>
        {event.descriptionSnippet ? (
          <Text variant="body2" tone="mutedOnCard" className={styles.description}>
            {event.descriptionSnippet}
          </Text>
        ) : null}
        {event.tags.length > 0 ? (
          <div className={styles.tags}>
            {event.tags.map((tag) => (
              <Text key={tag} variant="eyebrow" tone="onCard" as="span" className={styles.tag}>
                {tag}
              </Text>
            ))}
          </div>
        ) : null}
        <dl className={styles.facts}>
          <div>
            <Text variant="eyebrow" tone="onCard" as="dt">
              When
            </Text>
            <Text variant="body1" tone="onCard" as="dd" className={styles.factValue}>
              {event.dateLabel} · {event.timeLabel}
            </Text>
          </div>
          <div>
            <Text variant="eyebrow" tone="onCard" as="dt">
              Where
            </Text>
            <Text variant="body1" tone="onCard" as="dd" className={styles.factValue}>
              {event.venueName}
              {event.venueAddress ? ` · ${event.venueAddress}` : event.neighborhood ? ` · ${event.neighborhood}` : null}
            </Text>
          </div>
          {event.priceLabel ? (
            <div>
              <Text variant="eyebrow" tone="onCard" as="dt">
                Price
              </Text>
              <Text variant="body1" tone="onCard" as="dd" className={styles.factValue}>
                {event.priceLabel}
              </Text>
            </div>
          ) : null}
        </dl>
        <div className={styles.actions}>
          <Button to="/event/$slug" params={{ slug: event.slug }} variant="cta" className={styles.detailsButton}>
            VIEW DETAILS
          </Button>
        </div>
      </div>
    </div>
  );
}
