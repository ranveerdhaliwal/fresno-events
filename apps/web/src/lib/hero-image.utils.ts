/** MLB/MiLB team marks are small logos — never stretch with object-fit: cover. */
export function isTeamLogoHeroUrl(url: string | null | undefined): boolean {
  if (!url?.trim()) {
    return false;
  }

  try {
    const { hostname, pathname } = new URL(url.trim());
    if (!hostname.endsWith("mlbstatic.com")) {
      return false;
    }

    return pathname.includes("/team-logos/") || pathname.includes("/v1/team/");
  } catch {
    return false;
  }
}

/**
 * Square / logo-like promo art (team marks, 200×200 ticket thumbnails) should
 * use contain so cover does not crop or pixel-stretch them in wide heroes.
 */
export function isLogoLikeHeroUrl(url: string | null | undefined): boolean {
  if (isTeamLogoHeroUrl(url)) {
    return true;
  }
  if (!url?.trim()) {
    return false;
  }

  try {
    const { hostname, pathname } = new URL(url.trim());
    if (hostname.includes("cmtworks.com") && pathname.toLowerCase().includes("uplimage")) {
      return true;
    }
    if (/200x200/i.test(pathname)) {
      return true;
    }
    return false;
  } catch {
    return false;
  }
}

export function heroImageFit(url: string | null | undefined): "cover" | "contain" {
  return isLogoLikeHeroUrl(url) ? "contain" : "cover";
}

export function heroImagePadding(url: string | null | undefined): number | undefined {
  return isLogoLikeHeroUrl(url) ? 10 : undefined;
}
