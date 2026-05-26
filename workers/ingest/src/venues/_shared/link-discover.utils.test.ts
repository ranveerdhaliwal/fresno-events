import { describe, expect, it } from "vitest";

import towerConfig from "@/venues/tower-theatre/venue.config.json";
import type { VenueConfig } from "@/venues/venue.types";
import {
  discoverSaveMartDetailUrlsFromMarkdown,
  discoverTowerDetailUrls
} from "./link-discover.utils";

const tower = towerConfig as VenueConfig;

describe("discoverTowerDetailUrls", () => {
  it("extracts /e/{slug} links from listing HTML", () => {
    const html = `
      <html><body>
        <a href="/e/some-show">Show</a>
        <a href="https://towertheatre.ticketsauce.com/e/other">Other</a>
        <a href="/about">About</a>
      </body></html>
    `;
    const urls = discoverTowerDetailUrls(html, "https://towertheatre.ticketsauce.com/", tower);
    expect(urls).toContain("https://towertheatre.ticketsauce.com/e/some-show");
    expect(urls).toContain("https://towertheatre.ticketsauce.com/e/other");
    expect(urls).toHaveLength(2);
  });
});

describe("discoverSaveMartDetailUrlsFromMarkdown", () => {
  it("finds /event/.../id/ paths in markdown", () => {
    const md = `
      [Concert](https://www.savemartcenter.com/event/foo-bar/12345/)
      Also /event/another/99/ inline.
    `;
    const urls = discoverSaveMartDetailUrlsFromMarkdown(
      md,
      "https://www.savemartcenter.com/events-tickets/"
    );
    expect(urls.some((u) => u.includes("/event/foo-bar/12345"))).toBe(true);
    expect(urls.some((u) => u.includes("/event/another/99"))).toBe(true);
  });
});
