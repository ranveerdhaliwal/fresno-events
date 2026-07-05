import { useRouterState } from "@tanstack/react-router";

import { PlaceholderImage } from "@/components/PlaceholderImage";
import { Text } from "@/components/Text";
import { cn } from "@/lib/cn";

import { AdSenseUnit } from "./AdSenseUnit";
import { getAdSenseSlotId, isAdSenseLive, shouldShowLiveAds } from "./AdSlot.utils";

import styles from "./AdSlot.module.css";

export type AdSlotVariant = "banner-wide" | "banner-stacked" | "card" | "side";

export interface AdSlotProps {
  variant?: AdSlotVariant;
}

export function AdSlot({ variant = "banner-wide" }: AdSlotProps) {
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const clientId = import.meta.env.VITE_ADSENSE_CLIENT_ID?.trim();

  if (clientId && isAdSenseLive(variant) && shouldShowLiveAds(pathname)) {
    const slotId = getAdSenseSlotId(variant);
    if (slotId) {
      return <AdSenseUnit clientId={clientId} slotId={slotId} variant={variant} />;
    }
  }

  if (variant === "card") {
    return (
      <div className={styles.card} data-testid="ad-slot-card">
        <Text variant="eyebrow" tone="inverse" as="span" className={styles.tag}>
          AD
        </Text>
        <div className={styles.phImg}>
          <PlaceholderImage paletteKey="festival" label="LOCAL" />
        </div>
        <Text variant="header3" tone="onCard" as="h4">
          Support local venues
        </Text>
        <Text variant="body2" tone="mutedOnCard" as="p">
          Your ad could reach Fresno event-goers every week.
        </Text>
        <Text variant="eyebrow" tone="accent" as="span" className={styles.ctaLink}>
          LEARN MORE
        </Text>
      </div>
    );
  }

  if (variant === "side") {
    return (
      <div className={styles.side} data-testid="ad-slot-side">
        <Text variant="eyebrow" tone="inverse" as="span" className={styles.tag}>
          AD
        </Text>
        <Text variant="header3" tone="onCard" as="p" className={styles.sideTitle}>
          Local spotlight
        </Text>
        <Text variant="body2" tone="mutedOnCard" as="p" className={styles.sideCopy}>
          Your business here — reach event-goers weekly.
        </Text>
        <Text variant="eyebrow" tone="accent" as="span" className={styles.ctaLink}>
          LEARN MORE
        </Text>
      </div>
    );
  }

  return (
    <div
      className={cn(styles.banner, variant === "banner-wide" && styles.wide, variant === "banner-stacked" && styles.stacked)}
      data-testid="ad-slot"
    >
      <Text variant="eyebrow" tone="inverse" as="span" className={styles.tag}>
        AD
      </Text>
      <div className={styles.body}>
        <Text variant="header3" tone="onCard" as="h4">
          Reach Fresno locals
        </Text>
        <Text variant="body2" tone="mutedOnCard" as="p">
          Promote your business on What Up Fresno.
        </Text>
      </div>
      <Text variant="eyebrow" tone="accent" as="span" className={styles.cta}>
        GET STARTED
      </Text>
    </div>
  );
}
