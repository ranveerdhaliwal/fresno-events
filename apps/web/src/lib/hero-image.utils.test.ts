import { describe, expect, it } from "vitest";

import { heroImageFit, heroImagePadding, isTeamLogoHeroUrl } from "./hero-image.utils";

describe("hero-image.utils", () => {
  it("detects MLB team spot and logo URLs", () => {
    expect(isTeamLogoHeroUrl("https://midfield.mlbstatic.com/v1/team/259/spots/120")).toBe(true);
    expect(isTeamLogoHeroUrl("https://www.mlbstatic.com/team-logos/259.svg")).toBe(true);
    expect(isTeamLogoHeroUrl("https://images.unsplash.com/photo-1")).toBe(false);
    expect(isTeamLogoHeroUrl(null)).toBe(false);
  });

  it("uses contain fit for team logos", () => {
    expect(heroImageFit("https://www.mlbstatic.com/team-logos/259.svg")).toBe("contain");
    expect(heroImageFit("https://cdn.example.com/poster.jpg")).toBe("cover");
    expect(heroImagePadding("https://www.mlbstatic.com/team-logos/259.svg")).toBe(10);
  });
});
