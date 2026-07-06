import { Link } from "@tanstack/react-router";

import { PlaceholderImage } from "@/components/PlaceholderImage";
import { Text } from "@/components/Text";
import type { FeatureCardViewModel } from "@/lib/event-view-model";
import { heroImageFit, heroImagePadding } from "@/lib/hero-image.utils";
import { cn } from "@/lib/cn";
import { isListTicketPriceLabel } from "@/lib/event-price.utils";

import { formatFeaturedBadgeLabel, shouldShowFeaturedBadge } from "./FeatureCard.utils";
import styles from "./FeatureCard.module.css";

export interface FeatureCardProps {
  card: FeatureCardViewModel;
  variant?: "hero" | "small";
}

export function FeatureCard({ card, variant = "small" }: FeatureCardProps) {
  const imagePadding = heroImagePadding(card.imageUrl);

  return (
    <Link
      to="/event/$slug"
      params={{ slug: card.slug }}
      className={cn(styles.card, variant === "hero" && styles.hero)}
      data-testid={`feature-card-${card.slug}`}
    >
      <div className={styles.image}>
        <PlaceholderImage
          paletteKey={card.paletteKey}
          label={card.categoryLabel}
          imageUrl={card.imageUrl}
          imageFit={heroImageFit(card.imageUrl)}
          {...(imagePadding !== undefined ? { imagePadding } : {})}
        />
        {shouldShowFeaturedBadge(card.badge) ? (
          <Text variant="eyebrow" tone="inverse" as="span" className={cn(styles.badge, styles[card.badge])}>
            {formatFeaturedBadgeLabel(card.badge)}
          </Text>
        ) : null}
        <Text variant="body3" tone="onCard" as="span" className={styles.pillCat}>
          {card.categoryLabel}
        </Text>
      </div>
      <div className={styles.body}>
        <Text variant="header3" tone="onCard" as="h3" className={styles.cardTitle}>
          {card.title}
        </Text>
        <div className={styles.meta}>
          <Text variant="body3" tone="accent" as="span" className={styles.metaDate}>
            {card.dateLabel}
          </Text>
          <Text variant="body3" tone="labelOnCard" as="span">
            {card.timeLabel}
          </Text>
          <Text variant="body3" tone="labelOnCard" as="span">
            {card.venueName}
          </Text>
        </div>
        {variant === "hero" && card.description ? (
          <Text variant="body2" tone="mutedOnCard" className={styles.desc}>
            {card.description}
          </Text>
        ) : null}
        <div className={styles.priceRow}>
          {card.priceLabel ? (
            <Text
              variant="price"
              tone="accent"
              as="span"
              className={cn(
                card.isFree && styles.free,
                isListTicketPriceLabel(card.priceLabel) && styles.priceTicketHint
              )}
            >
              {card.priceLabel}
            </Text>
          ) : null}
          <Text variant="body3" tone="mutedOnCard" as="span" className={styles.source}>
            via What Up Fresno
          </Text>
        </div>
      </div>
    </Link>
  );
}
