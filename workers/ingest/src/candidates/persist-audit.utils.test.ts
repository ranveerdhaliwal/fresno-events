import { describe, expect, it } from "vitest";

import type { NormalizedEvent } from "@fresno-events/shared";

import {
  buildChangedAuditItem,
  buildNewAuditItem,
  buildPersistAuditSummary,
  capAuditItems,
  diffNormalizedEvents,
  truncateForLog
} from "./persist-audit.utils";

const base: NormalizedEvent = {
  source: "api:milb",
  sourceEventId: "game-1",
  title: "Grizzlies vs Buzzers",
  venueName: "Chukchansi Park",
  startTs: "2026-06-01T02:00:00.000Z",
  category: "sports"
};

describe("persist-audit.utils", () => {
  it("diffNormalizedEvents reports changed fields only", () => {
    const after = { ...base, title: "New title", ticketUrl: "https://tickets.example" };
    const diff = diffNormalizedEvents(base, after);

    expect(diff.changedFields).toEqual(["title", "ticketUrl"]);
    expect(diff.before.title).toBe(base.title);
    expect(diff.after.title).toBe("New title");
  });

  it("diffNormalizedEvents reports price fields", () => {
    const after = { ...base, priceMin: 45, priceMax: 65, priceNotes: "In-Person: $45/$65" };
    const diff = diffNormalizedEvents(base, after);

    expect(diff.changedFields).toEqual(["priceMin", "priceMax", "priceNotes"]);
    expect(diff.after.priceMin).toBe("45");
    expect(diff.after.priceMax).toBe("65");
  });

  it("buildNewAuditItem captures listing fields and external_url", () => {
    expect(buildNewAuditItem({ ...base, externalUrl: "https://example.com/game" })).toEqual({
      source: "api:milb",
      source_event_id: "game-1",
      title: base.title,
      start_ts: base.startTs,
      venue_name: base.venueName,
      external_url: "https://example.com/game"
    });
  });

  it("buildChangedAuditItem wraps diff", () => {
    const after = { ...base, startTs: "2026-06-02T02:00:00.000Z" };
    const item = buildChangedAuditItem(base, after);

    expect(item.source_event_id).toBe("game-1");
    expect(item.changed_fields).toEqual(["startTs"]);
    expect(item.before.startTs).toBe(base.startTs);
    expect(item.after.startTs).toBe(after.startTs);
  });

  it("buildPersistAuditSummary includes all item lists", () => {
    const newItems = Array.from({ length: 25 }, (_, index) =>
      buildNewAuditItem({ ...base, sourceEventId: `id-${index}`, title: `Event ${index}` })
    );

    const summary = buildPersistAuditSummary({
      newItems,
      changedItems: [],
      unchangedCount: 3
    });

    expect(summary.new).toBe(25);
    expect(summary.new_items).toHaveLength(25);
    expect(summary.unchanged).toBe(3);
  });

  it("capAuditItems and truncateForLog", () => {
    expect(capAuditItems([1, 2, 3], 2)).toEqual([1, 2]);
    expect(truncateForLog("x".repeat(250), 200)?.endsWith("…")).toBe(true);
    expect(truncateForLog(null)).toBeNull();
  });
});
