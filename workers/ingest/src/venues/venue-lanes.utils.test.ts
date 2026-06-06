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

  it("honors ingestLane override", () => {
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
    expect(direct).toContain("strummers");
    expect(direct).toContain("gobulldogs");
  });

  it("puts plain-html and API venues in direct lane", () => {
    const direct = venueKeysByLane(configs, "direct");
    expect(direct).toContain("chaffee-zoo");
    expect(direct).toContain("fresno-convention-center");
    expect(direct).toContain("rainbow-ballroom");
    expect(direct).toContain("save-mart");
    expect(direct).toContain("big-fresno-fair");
  });

  it("keeps tower on direct lane when plain HTML is configured", () => {
    const direct = venueKeysByLane(configs, "direct");
    expect(direct).toContain("tower-theatre");
    const browser = venueKeysByLane(configs, "browser");
    expect(browser).not.toContain("tower-theatre");
  });

  it("enabled configs partition into direct + browser", () => {
    const enabled = configs.filter((config) => config.enabled);
    const direct = filterVenuesByLane(enabled, "direct");
    const browser = filterVenuesByLane(enabled, "browser");
    expect(direct.length + browser.length).toBe(enabled.length);
  });
});
