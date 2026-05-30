import { describe, expect, it } from "vitest";

import type { VenueConfig } from "@/venues/venue.types";
import { filterVenuesByLane, venueIngestLane, venueKeysByLane } from "@/venues/venue-lanes.utils";
import { allVenueConfigs } from "@/venues/registry";

describe("venueIngestLane", () => {
  it("classifies api and html_parse as direct by default", () => {
    expect(venueIngestLane({ strategy: "api" })).toBe("direct");
    expect(venueIngestLane({ strategy: "html_parse" })).toBe("direct");
  });

  it("classifies listing pipelines as browser by default", () => {
    expect(venueIngestLane({ strategy: "listing_then_detail" })).toBe("browser");
    expect(venueIngestLane({ strategy: "month_windows_then_detail" })).toBe("browser");
    expect(venueIngestLane({ strategy: "scroll_listing_then_detail" })).toBe("browser");
  });

  it("honors ingestLane override (gobulldogs SPA → browser)", () => {
    expect(venueIngestLane({ strategy: "html_parse", ingestLane: "browser" })).toBe("browser");
  });
});

describe("venueKeysByLane", () => {
  const configs = allVenueConfigs();

  it("puts API venues in direct lane", () => {
    const direct = venueKeysByLane(configs, "direct");
    expect(direct).toContain("visit-fresno-county");
    expect(direct).toContain("downtown-fresno");
    expect(direct).toContain("milb-grizzlies");
    expect(direct).not.toContain("strummers");
    expect(direct).not.toContain("gobulldogs");
  });

  it("puts gobulldogs in browser lane via ingestLane override", () => {
    const browser = venueKeysByLane(configs, "browser");
    expect(browser).toContain("gobulldogs");
  });

  it("puts BR crawl venues in browser lane", () => {
    const browser = venueKeysByLane(configs, "browser");
    expect(browser).toContain("strummers");
    expect(browser).toContain("tower-theatre");
    expect(browser).toContain("save-mart");
    expect(browser).not.toContain("visit-fresno-county");
  });

  it("enabled configs partition into direct + browser", () => {
    const enabled = configs.filter((config) => config.enabled);
    const direct = filterVenuesByLane(enabled, "direct");
    const browser = filterVenuesByLane(enabled, "browser");
    expect(direct.length + browser.length).toBe(enabled.length);
  });
});
