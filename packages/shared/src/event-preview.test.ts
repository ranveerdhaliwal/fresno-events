import { describe, expect, it } from "vitest";

import { selectEventPreview } from "./event-preview.js";

function item(id: string, priority: number, startTs: string) {
  return { event: { id, priority, startTs } };
}

describe("selectEventPreview", () => {
  it("keeps all p1-p2 and caps lower priorities", () => {
    const items = [
      item("a", 1, "2026-06-01T18:00:00Z"),
      item("b", 2, "2026-06-01T19:00:00Z"),
      item("c", 3, "2026-06-01T20:00:00Z"),
      item("d", 3, "2026-06-01T21:00:00Z"),
      item("e", 3, "2026-06-01T22:00:00Z"),
      item("f", 3, "2026-06-01T23:00:00Z"),
      item("g", 5, "2026-06-02T01:00:00Z")
    ];

    const result = selectEventPreview(items);
    expect(result.preview.map((row) => row.event.id)).toEqual(["a", "b", "c", "d", "e", "g"]);
    expect(result.total).toBe(7);
    expect(result.hidden).toBe(1);
  });
});
