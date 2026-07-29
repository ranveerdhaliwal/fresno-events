import { describe, expect, it } from "vitest";

import {
  ATMOSPHERE_MOBILE_MAX_WIDTH_PX,
  HOME_ATMOSPHERE,
  HOME_ATMOSPHERE_IMAGE,
  HOME_ATMOSPHERE_IMAGES,
  HOME_ATMOSPHERE_PACK,
  isMobileAtmosphereViewport,
  pickAtmosphereImage,
  pickAtmosphereVariant,
  pickAtmosphereVariantExcluding,
  resolveAtmosphereUrl
} from "./home-atmosphere";

describe("home-atmosphere", () => {
  it("exposes a toggleable atmosphere id with a PD image pack", () => {
    expect(["none", "veiled-sierra"]).toContain(HOME_ATMOSPHERE);
    expect(HOME_ATMOSPHERE_PACK).toHaveLength(14);
    expect(HOME_ATMOSPHERE_IMAGES).toHaveLength(14);
    expect(HOME_ATMOSPHERE_PACK.every((v) => v.desktop.startsWith("/atmosphere/") && v.mobile.endsWith("-sm.jpg"))).toBe(
      true
    );
    expect(HOME_ATMOSPHERE_IMAGE["veiled-sierra"]).toMatch(/atmosphere/);
  });

  it("picks a deterministic variant when random is stubbed", () => {
    const first = pickAtmosphereVariant(HOME_ATMOSPHERE_PACK, () => 0);
    expect(first).toEqual(HOME_ATMOSPHERE_PACK[0]);

    const last = pickAtmosphereVariant(HOME_ATMOSPHERE_PACK, () => 0.999);
    expect(last).toEqual(HOME_ATMOSPHERE_PACK[13]);
  });

  it("can exclude the current variant when picking the next page backdrop", () => {
    const current = HOME_ATMOSPHERE_PACK[0]!;
    const next = pickAtmosphereVariantExcluding(current.id, HOME_ATMOSPHERE_PACK, () => 0);
    expect(next.id).not.toBe(current.id);
    expect(next).toEqual(HOME_ATMOSPHERE_PACK[1]);
  });

  it("resolves mobile vs desktop URLs for the same variant", () => {
    const chosen = HOME_ATMOSPHERE_PACK[2]!;
    expect(resolveAtmosphereUrl(chosen, { isMobile: false })).toBe(chosen.desktop);
    expect(resolveAtmosphereUrl(chosen, { isMobile: true })).toBe(chosen.mobile);
    expect(resolveAtmosphereUrl(chosen, { isMobile: true })).toContain("-sm.jpg");
  });

  it("treats narrow viewports as mobile for atmosphere assets", () => {
    expect(isMobileAtmosphereViewport(ATMOSPHERE_MOBILE_MAX_WIDTH_PX)).toBe(true);
    expect(isMobileAtmosphereViewport(ATMOSPHERE_MOBILE_MAX_WIDTH_PX + 1)).toBe(false);
    expect(isMobileAtmosphereViewport(390)).toBe(true);
  });

  it("covers the full pack across random draws", () => {
    const seen = new Set<string>();
    for (let i = 0; i < HOME_ATMOSPHERE_PACK.length; i += 1) {
      seen.add(pickAtmosphereVariant(HOME_ATMOSPHERE_PACK, () => i / HOME_ATMOSPHERE_PACK.length).id);
    }
    expect(seen.size).toBe(HOME_ATMOSPHERE_PACK.length);
  });

  it("keeps legacy pickAtmosphereImage working for desktop paths", () => {
    expect(pickAtmosphereImage(HOME_ATMOSPHERE_IMAGES, () => 0)).toBe(HOME_ATMOSPHERE_IMAGES[0]);
  });
});
