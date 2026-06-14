import { describe, expect, it } from "vitest";

import type { IngestEnv } from "@/env";
import { canRunScraper, planIngestRuns } from "@/planner";
import { scrapers } from "@/registry";

describe("planner", () => {
  it("cron batch includes only cron scrapers", async () => {
    const env = {
      TICKETMASTER_API_KEY: "tm-key",
      CLOUDFLARE_ACCOUNT_ID: "acc",
      CLOUDFLARE_API_TOKEN: "tok"
    } as IngestEnv;

    const planned = await planIngestRuns(env, { force: true });
    const keys = planned.map((p) => p.key);

    expect(keys).toContain("ticketmaster");
    expect(keys).toContain("venunite");
    expect(keys).toContain("venue-ingest");
    expect(keys).toHaveLength(3);
  });

  it("--all matches cron scrapers (no manual-only sources registered)", async () => {
    const env = {
      TICKETMASTER_API_KEY: "tm-key",
      CLOUDFLARE_ACCOUNT_ID: "acc",
      CLOUDFLARE_API_TOKEN: "tok"
    } as IngestEnv;

    const planned = await planIngestRuns(env, { sources: "all", force: true });
    expect(planned.map((p) => p.key).sort()).toEqual(["ticketmaster", "venue-ingest", "venunite"]);
  });

  it("venue-ingest is cron when Cloudflare BR is configured", () => {
    const venueIngest = scrapers.find((s) => s.key === "venue-ingest");
    expect(venueIngest?.schedule).toBe("cron");
    expect(
      canRunScraper(
        {
          CLOUDFLARE_ACCOUNT_ID: "acc",
          CLOUDFLARE_API_TOKEN: "tok"
        } as IngestEnv,
        venueIngest!
      )
    ).toBe(true);
  });
});
