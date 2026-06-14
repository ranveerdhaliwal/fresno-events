import type { AdSlotVariant } from "./AdSlot";

const SLOT_ENV_BY_VARIANT: Record<AdSlotVariant, keyof ImportMetaEnv> = {
  "banner-wide": "VITE_ADSENSE_SLOT_BANNER_WIDE",
  "banner-stacked": "VITE_ADSENSE_SLOT_BANNER_STACKED",
  card: "VITE_ADSENSE_SLOT_CARD",
  side: "VITE_ADSENSE_SLOT_SIDE"
};

export function getAdSenseSlotId(variant: AdSlotVariant): string | undefined {
  const key = SLOT_ENV_BY_VARIANT[variant];
  const id = import.meta.env[key]?.trim();
  return id || undefined;
}

export function isAdSenseLive(variant: AdSlotVariant): boolean {
  const clientId = import.meta.env.VITE_ADSENSE_CLIENT_ID?.trim();
  const slotId = getAdSenseSlotId(variant);
  return Boolean(clientId && slotId);
}

export function shouldShowLiveAds(pathname: string): boolean {
  return !pathname.startsWith("/admin");
}
