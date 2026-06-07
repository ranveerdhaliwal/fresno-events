import { describe, expect, it } from "vitest";

import type { IngestEnv } from "@/env";
import { canRunScraper, planIngestRuns } from "@/planner";
import { scrapers } from "@/registry";

describe("planner", () => {
  it("cron batch excludes manual-only sources", async () => {
    const env = {
      TICKETMASTER_API_KEY: "tm-key",
      CLOUDFLARE_ACCOUNT_ID: "acc",
      CLOUDFLARE_API_TOKEN: "tok",
      VISIT_FRESNO_API_TOKEN: "vf"
    } as IngestEnv;

    const planned = await planIngestRuns(env, { force: true });
    const keys = planned.map((p) => p.key);

    expect(keys).toContain("ticketmaster");
    expect(keys).toContain("venunite");
    expect(keys).toContain("venue-ingest");
    expect(keys).not.toContain("seatgeek");
    expect(keys).not.toContain("ai-discovery");
    expect(keys).not.toContain("visit-fresno-api");
  });

  it("--all includes manual-only when runnable", async () => {
    const env = {
      TICKETMASTER_API_KEY: "tm-key",
      SEATGEEK_CLIENT_ID: "id",
      SEATGEEK_CLIENT_SECRET: "secret"
    } as IngestEnv;

    const planned = await planIngestRuns(env, { sources: "all", force: true });
    expect(planned.map((p) => p.key)).toContain("seatgeek");
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
