import { describe, expect, it, vi } from "vitest";

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
    expect(keys).toContain("visit-fresno-api");
    expect(keys).toContain("milb-api");
    expect(keys).not.toContain("seatgeek");
    expect(keys).not.toContain("ai-discovery");
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

  it("downtown-fresno is always runnable without env key", () => {
    const downtown = scrapers.find((s) => s.key === "downtown-fresno-api");
    expect(downtown?.schedule).toBe("cron");
    expect(canRunScraper({} as IngestEnv, downtown!)).toBe(true);
  });
});
