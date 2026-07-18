import { describe, expect, it } from "vitest";

import type { NormalizedEvent } from "@fresno-events/shared";

import { buildContentDiff } from "@/routes/review/diff.utils";

const proposed: NormalizedEvent = {
  source: "api:milb",
  sourceEventId: "game-1",
  title: "Updated title",
  venueName: "Chukchansi Park",
  startTs: "2026-06-01T02:00:00.000Z",
  category: "sports",
  descriptionText: "New description"
};

describe("buildContentDiff", () => {
  it("returns null when published matches proposed", () => {
    expect(
      buildContentDiff(
        {
          title: proposed.title,
          startTs: proposed.startTs,
          category: proposed.category ?? "community",
          venueName: proposed.venueName,
          ...(proposed.descriptionText ? { descriptionText: proposed.descriptionText } : {})
        },
        proposed
      )
    ).toBeNull();
  });

  it("lists changed fields with labels", () => {
    const diff = buildContentDiff(
      {
        title: "Old title",
        startTs: proposed.startTs,
        category: "community",
        venueName: proposed.venueName,
        descriptionText: "Old description"
      },
      proposed
    );

    expect(diff?.changedFields).toEqual(["title", "descriptionText", "category"]);
    expect(diff?.entries.map((entry) => entry.label)).toEqual(["Title", "Description", "Category"]);
    expect(diff?.entries[0]?.before).toBe("Old title");
    expect(diff?.entries[0]?.after).toBe("Updated title");
  });

  it("includes price changes", () => {
    const diff = buildContentDiff(
      {
        title: proposed.title,
        startTs: proposed.startTs,
        category: proposed.category ?? "community",
        venueName: proposed.venueName,
        descriptionText: proposed.descriptionText,
        priceMin: 20,
        priceMax: 40
      },
      { ...proposed, priceMin: 45, priceMax: 65 }
    );

    expect(diff?.changedFields).toEqual(["priceMin", "priceMax"]);
    expect(diff?.entries[0]?.before).toBe("20");
    expect(diff?.entries[0]?.after).toBe("45");
  });
});
