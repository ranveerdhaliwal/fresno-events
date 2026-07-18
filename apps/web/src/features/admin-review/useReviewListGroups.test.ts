import { describe, expect, it, vi } from "vitest";

import type { EventCandidate } from "@fresno-events/shared";

import { act, renderHook } from "@/tests/render";

import { useReviewListGroups } from "./useReviewListGroups";

function candidate(
  id: string,
  overrides: Partial<EventCandidate> & { source?: string; title?: string } = {}
): EventCandidate {
  const source = overrides.source ?? "ticketmaster";
  const title = overrides.title ?? id;
  return {
    id,
    source,
    sourceEventId: id,
    title,
    venueName: "Venue",
    startTs: "2026-10-01T00:00:00.000Z",
    normalizedEvent: {
      source,
      sourceEventId: id,
      title,
      venueName: "Venue",
      startTs: "2026-10-01T00:00:00.000Z",
      category: "music",
      subcategories: [],
      tags: [],
      currency: "USD"
    },
    rawPayload: {},
    dedupeHash: id,
    confidenceScore: 1,
    status: "pending_review",
    createdAt: "2026-06-01T00:00:00.000Z",
    updatedAt: "2026-06-01T00:00:00.000Z",
    detailStatus: "pending",
    occurrenceId: id,
    ...overrides
  };
}

describe("useReviewListGroups", () => {
  it("groups pending rows by source and keeps a valid selection", () => {
    const onSelect = vi.fn();
    const items = [
      candidate("a", { source: "ticketmaster", title: "Alpha Show" }),
      candidate("b", { source: "venunite", title: "Beta Night" })
    ];

    const { result } = renderHook(() =>
      useReviewListGroups({
        items,
        statusFilter: "pending_review",
        searchQuery: "",
        priorityOverrides: {},
        selectedId: "missing",
        onSelect
      })
    );

    expect(result.current.searchActive).toBe(false);
    expect(result.current.visibleListItems.map((row) => row.id).sort()).toEqual(["a", "b"]);
    expect(result.current.listGroups.length).toBeGreaterThan(0);
    expect(onSelect).toHaveBeenCalledWith(expect.any(String));
  });

  it("filters the visible list when search is active", () => {
    const items = [
      candidate("a", { title: "Jazz Night" }),
      candidate("b", { title: "Comedy Hour" })
    ];

    const { result } = renderHook(() =>
      useReviewListGroups({
        items,
        statusFilter: "pending_review",
        searchQuery: "jazz",
        priorityOverrides: {},
        selectedId: "a",
        onSelect: vi.fn()
      })
    );

    expect(result.current.searchActive).toBe(true);
    expect(result.current.visibleListItems.map((row) => row.id)).toEqual(["a"]);
  });

  it("uses a flat reviewed list for approved/rejected tabs", () => {
    const items = [
      candidate("a", {
        status: "approved",
        reviewedAt: "2026-06-02T00:00:00.000Z"
      }),
      candidate("b", {
        status: "approved",
        reviewedAt: "2026-06-03T00:00:00.000Z"
      })
    ];

    const { result } = renderHook(() =>
      useReviewListGroups({
        items,
        statusFilter: "approved",
        searchQuery: "",
        priorityOverrides: {},
        selectedId: "a",
        onSelect: vi.fn()
      })
    );

    expect(result.current.listGroups).toHaveLength(1);
    expect(result.current.listGroups[0]?.source).toBe("");
    expect(result.current.visibleListItems.map((row) => row.id)).toEqual(["b", "a"]);
  });

  it("re-syncs selection when the visible list changes", () => {
    const onSelect = vi.fn();
    const first = [candidate("a"), candidate("b")];
    const second = [candidate("b")];

    const { result, rerender } = renderHook(
      ({ items }) =>
        useReviewListGroups({
          items,
          statusFilter: "pending_review",
          searchQuery: "",
          priorityOverrides: {},
          selectedId: "a",
          onSelect
        }),
      { initialProps: { items: first } }
    );

    expect(result.current.activeId).toBe("a");

    act(() => {
      rerender({ items: second });
    });

    expect(onSelect).toHaveBeenCalledWith("b");
  });
});
