import { expect, it, vi } from "vitest";
import { persistAndEnrichVenueEvents } from "./persist-and-enrich-venue";
import { persistScrapeResult } from "@/candidates";
import { runPostIngestEnrichment } from "@/runner";
import { runEventbriteDetailBackfill } from "@/eventbrite-detail-backfill";
vi.mock("@/candidates", () => ({
  persistScrapeResult: vi.fn().mockResolvedValue({ persisted: true }),
}));
vi.mock("@/runner", () => ({ runPostIngestEnrichment: vi.fn() }));
vi.mock("@/eventbrite-detail-backfill", () => ({
  runEventbriteDetailBackfill: vi.fn(),
}));
vi.mock("@/ticket-site-detail-backfill", () => ({
  runTicketSiteDetailBackfill: vi.fn(),
}));
vi.mock("@/lib/series-metadata.utils", () => ({
  applySeriesMetadata: async (events: unknown) => events,
}));
it("persists collection but defers detail and AI when no-enrich is requested", async () => {
  const event = {
    source: "scrape:test",
    sourceEventId: "1",
    title: "Concert",
    startTs: "2027-10-06T20:00:00Z",
    venueName: "Hall",
  };
  const result = await persistAndEnrichVenueEvents(
    {},
    "run",
    [event],
    "scrape:test",
    { skipEnrichment: true },
  );
  expect(persistScrapeResult).toHaveBeenCalledOnce();
  expect(result.events).toEqual([event]);
  expect(result.enrichment).toBeNull();
  expect(runPostIngestEnrichment).not.toHaveBeenCalled();
  expect(runEventbriteDetailBackfill).not.toHaveBeenCalled();
});
