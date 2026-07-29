/**
 * Site atmosphere backdrop.
 * Flip `HOME_ATMOSPHERE` to `"none"` to disable without deleting assets/code.
 *
 * Image pack: public-domain Sierra / Valley landscapes under `/public/atmosphere/`
 * (see `SOURCES.json`). One is chosen at random on first paint; route changes crossfade
 * to another image. Mobile gets `*-sm.jpg`.
 */
export type HomeAtmosphereId = "none" | "veiled-sierra";

export const HOME_ATMOSPHERE: HomeAtmosphereId = "veiled-sierra";

/** Viewport width at/below which we serve the mobile atmosphere JPEG. */
export const ATMOSPHERE_MOBILE_MAX_WIDTH_PX = 768;

export interface AtmosphereImageVariant {
  id: string;
  /** ~2560px desktop JPEG */
  desktop: string;
  /** ~1280px mobile JPEG */
  mobile: string;
}

function variant(id: string): AtmosphereImageVariant {
  return {
    id,
    desktop: `/atmosphere/${id}.jpg`,
    mobile: `/atmosphere/${id}-sm.jpg`
  };
}

/** Public-domain atmosphere pack (NPS / USGS via Wikimedia Commons). */
export const HOME_ATMOSPHERE_PACK: readonly AtmosphereImageVariant[] = [
  variant("snow-yosemite"),
  variant("snow-yosemite-b"),
  variant("snow-yosemite-c"),
  variant("yosemite-yose3441"),
  variant("yosemite-yose8123"),
  variant("yosemite-visitors"),
  variant("sequoia-seki2207"),
  variant("sequoia-seki3791"),
  variant("sequoia-dark-sky"),
  variant("forsyth-peak"),
  variant("mount-hoffmann"),
  variant("yosemite-2017a"),
  variant("yosemite-2017b"),
  variant("yosemite-2017c")
] as const;

/** Desktop URLs only — prefer HOME_ATMOSPHERE_PACK for new code. */
export const HOME_ATMOSPHERE_IMAGES: readonly string[] = HOME_ATMOSPHERE_PACK.map((v) => v.desktop);

/** @deprecated Prefer HOME_ATMOSPHERE_PACK — kept for older imports/tests. */
export const HOME_ATMOSPHERE_IMAGE: Record<Exclude<HomeAtmosphereId, "none">, string> = {
  "veiled-sierra": HOME_ATMOSPHERE_IMAGES[0]!
};

export function isMobileAtmosphereViewport(
  widthPx: number,
  breakpointPx: number = ATMOSPHERE_MOBILE_MAX_WIDTH_PX
): boolean {
  return widthPx <= breakpointPx;
}

/** Pick one atmosphere variant. Uses Math.random (new pick each full page load). */
export function pickAtmosphereVariant(
  pack: readonly AtmosphereImageVariant[] = HOME_ATMOSPHERE_PACK,
  random: () => number = Math.random
): AtmosphereImageVariant {
  if (pack.length === 0) {
    return variant("snow-yosemite");
  }
  const index = Math.floor(random() * pack.length);
  return pack[index] ?? pack[0]!;
}

/** Prefer a different landscape than `excludeId` when navigating between pages. */
export function pickAtmosphereVariantExcluding(
  excludeId: string | null | undefined,
  pack: readonly AtmosphereImageVariant[] = HOME_ATMOSPHERE_PACK,
  random: () => number = Math.random
): AtmosphereImageVariant {
  if (!excludeId || pack.length <= 1) {
    return pickAtmosphereVariant(pack, random);
  }
  const filtered = pack.filter((entry) => entry.id !== excludeId);
  return pickAtmosphereVariant(filtered.length > 0 ? filtered : pack, random);
}

/** Resolve desktop vs mobile URL for a chosen variant. */
export function resolveAtmosphereUrl(
  chosen: AtmosphereImageVariant,
  options: { isMobile: boolean }
): string {
  return options.isMobile ? chosen.mobile : chosen.desktop;
}

/** @deprecated Prefer pickAtmosphereVariant + resolveAtmosphereUrl. */
export function pickAtmosphereImage(
  images: readonly string[] = HOME_ATMOSPHERE_IMAGES,
  random: () => number = Math.random
): string {
  if (images.length === 0) {
    return HOME_ATMOSPHERE_IMAGE["veiled-sierra"];
  }
  const index = Math.floor(random() * images.length);
  return images[index] ?? images[0]!;
}
