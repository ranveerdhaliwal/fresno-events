import { describe, expect, it } from "vitest";

import towerConfig from "@/venues/tower-theatre/venue.config.json";
import type { VenueConfig } from "@/venues/venue.types";
import {
  canonicalStrummersShowUrl,
  discoverSaveMartDetailUrlsFromMarkdown,
  discoverStrummersDetailUrls,
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
    expect(urls).toEqual([
      "https://towertheatre.ticketsauce.com/e/some-show",
      "https://towertheatre.ticketsauce.com/e/other"
    ]);
  });
});

describe("discoverStrummersDetailUrls", () => {
  it("dedupes ical feed links to canonical show URLs", () => {
    const html = `
      <a href="/shows/2026/6/6/agent-orange">Show</a>
      <a href="/shows/2026/6/6/agent-orange?format=ical">ICAL</a>
    `;
    const urls = discoverStrummersDetailUrls(html, "https://www.strummersclub.com/shows", tower);
    expect(urls).toEqual(["https://www.strummersclub.com/shows/2026/6/6/agent-orange"]);
  });
});

describe("canonicalStrummersShowUrl", () => {
  it("strips query and hash", () => {
    expect(
      canonicalStrummersShowUrl(
        "https://www.strummersclub.com/shows/2026/6/6/agent-orange?format=ical"
      )
    ).toBe("https://www.strummersclub.com/shows/2026/6/6/agent-orange");
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
