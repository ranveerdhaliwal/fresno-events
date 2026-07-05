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

export function heroImageFit(url: string | null | undefined): "cover" | "contain" {
  return isTeamLogoHeroUrl(url) ? "contain" : "cover";
}

export function heroImagePadding(url: string | null | undefined): number | undefined {
  return isTeamLogoHeroUrl(url) ? 10 : undefined;
}
