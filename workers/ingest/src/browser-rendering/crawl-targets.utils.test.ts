import { describe, expect, it } from "vitest";

import {
  buildTicketsauceMonthUrls,
  parseCrawlHints,
  resolveCrawlTargets,
  shouldLogPoll
} from "./crawl-targets.utils";
import type { SeedUrlRow } from "@/seed-urls";

function seedRow(overrides: Partial<SeedUrlRow> = {}): SeedUrlRow {
  return {
    id: "id",
    url: "https://towertheatre.ticketsauce.com/",
    label: "Tower",
    enabled: true,
    lane: "crawl",
    crawl_hints: {},
    br_crawl_job_id: null,
    br_crawl_status: null,
    br_crawl_started_at: null,
    last_successful_crawl_at: null,
    events_found_last_run: null,
    ...overrides
  };
}

describe("buildTicketsauceMonthUrls", () => {
  it("builds monthly query URLs from base", () => {
    const targets = buildTicketsauceMonthUrls("https://towertheatre.ticketsauce.com/", {
      now: new Date("2026-05-15T12:00:00Z"),
      horizonMonths: 2
    });
    expect(targets).toHaveLength(2);
    expect(targets[0]?.url).toContain("start=2026-05-01");
    expect(targets[0]?.url).toContain("end=2026-05-31");
    expect(targets[1]?.url).toContain("start=2026-06-01");
    expect(targets[1]?.url).toContain("end=2026-06-30");
  });
});

describe("resolveCrawlTargets", () => {
  it("expands ticketsauce provider into month windows", () => {
    const { targets, hints } = resolveCrawlTargets(
      seedRow({ crawl_hints: { provider: "ticketsauce", horizonMonths: 3 } }),
      new Date("2026-06-01T12:00:00Z")
    );
    expect(hints.provider).toBe("ticketsauce");
    expect(targets.length).toBe(3);
  });

  it("defaults to single listing_page target", () => {
    const { targets, hints } = resolveCrawlTargets(seedRow());
    expect(hints.provider).toBe("listing_page");
    expect(targets).toEqual([{ url: seedRow().url, windowIndex: 1, windowTotal: 1 }]);
  });
});

describe("parseCrawlHints", () => {
  it("defaults unknown provider to listing_page", () => {
    expect(parseCrawlHints({ provider: "unknown" }).provider).toBe("listing_page");
  });
});

describe("shouldLogPoll", () => {
  it("logs first poll and status changes", () => {
    expect(shouldLogPoll({ pollCount: 1, elapsedMs: 0, statusChanged: false, lastLoggedAtMs: 0, logIntervalMs: 30_000 })).toBe(
      true
    );
    expect(
      shouldLogPoll({ pollCount: 5, elapsedMs: 10_000, statusChanged: true, lastLoggedAtMs: 5_000, logIntervalMs: 30_000 })
    ).toBe(true);
  });

  it("throttles repeated running polls", () => {
    expect(
      shouldLogPoll({ pollCount: 5, elapsedMs: 10_000, statusChanged: false, lastLoggedAtMs: 8_000, logIntervalMs: 30_000 })
    ).toBe(false);
    expect(
      shouldLogPoll({ pollCount: 5, elapsedMs: 40_000, statusChanged: false, lastLoggedAtMs: 5_000, logIntervalMs: 30_000 })
    ).toBe(true);
  });
});
