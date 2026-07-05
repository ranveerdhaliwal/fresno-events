import { describe, expect, it } from "vitest";

import {
  buildEventDescription,
  buildEventJsonLd,
  buildEventTitle,
  buildHomeTitle,
  buildOgTags,
  canonicalUrl,
  resolveOgImageUrl,
  truncateMetaDescription
} from "./seo.utils.js";

describe("seo.utils", () => {
  it("builds canonical apex URLs", () => {
    expect(canonicalUrl("/event/foo")).toBe("https://whatupfresno.com/event/foo");
  });

  it("truncates long descriptions", () => {
    const text = "a".repeat(200);
    expect(truncateMetaDescription(text)).toHaveLength(160);
    expect(truncateMetaDescription(text).endsWith("…")).toBe(true);
  });

  it("builds event titles and descriptions", () => {
    expect(
      buildEventTitle({ title: "Jazz Night" }, { name: "Tower Theatre" })
    ).toBe("Jazz Night · Tower Theatre · What Up Fresno");

    const description = buildEventDescription(
      {
        title: "Jazz Night",
        descriptionText: "Live horns and cocktails.",
        startTs: "2026-08-01T19:00:00-07:00"
      },
      { name: "Tower Theatre" }
    );
    expect(description).toContain("Jazz Night");
    expect(description).toContain("Tower Theatre");
    expect(description).toContain("Fresno");
  });

  it("resolves og image from hero URL or default", () => {
    expect(resolveOgImageUrl("https://cdn.example.com/poster.jpg")).toBe(
      "https://cdn.example.com/poster.jpg"
    );
    expect(resolveOgImageUrl(null)).toBe("https://whatupfresno.com/brand/nav-mark.svg");
  });

  it("builds og tags with canonical URL", () => {
    const tags = buildOgTags({
      title: buildHomeTitle(),
      description: "Fresno events",
      canonicalPath: "/",
      ogImageUrl: "https://cdn.example.com/poster.jpg",
      type: "website"
    });
    expect(tags.url).toBe("https://whatupfresno.com/");
    expect(tags.image).toBe("https://cdn.example.com/poster.jpg");
  });

  it("builds event JSON-LD with offer and location", () => {
    const jsonLd = buildEventJsonLd({
      event: {
        title: "Jazz Night",
        descriptionText: "Live horns.",
        startTs: "2026-08-01T19:00:00-07:00",
        endTs: "2026-08-01T22:00:00-07:00",
        status: "scheduled",
        category: "music",
        slug: "jazz-night-2026-08-01-1900",
        isFree: false,
        priceMin: 25,
        priceMax: 25,
        currency: "USD",
        ticketUrl: "https://tickets.example.com/jazz"
      },
      venue: {
        name: "Tower Theatre",
        address: "815 E Olive Ave",
        city: "Fresno",
        lat: 36.75,
        lng: -119.77,
        slug: "tower-theatre"
      },
      heroImageUrl: "https://cdn.example.com/poster.jpg"
    });

    expect(jsonLd["@type"]).toBe("MusicEvent");
    expect(jsonLd.url).toBe("https://whatupfresno.com/event/jazz-night-2026-08-01-1900");
    expect(jsonLd.offers).toMatchObject({ price: 25, priceCurrency: "USD" });
  });
});
