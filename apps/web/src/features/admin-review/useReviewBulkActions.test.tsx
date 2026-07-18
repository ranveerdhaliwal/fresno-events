import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { describe, expect, it, vi } from "vitest";
import type { ReactNode } from "react";

import type { EventCandidate } from "@fresno-events/shared";

import { act, renderHook } from "@/tests/render";

import { useReviewBulkActions } from "./useReviewBulkActions";

function candidate(id: string): EventCandidate {
  return {
    id,
    source: "ticketmaster",
    sourceEventId: id,
    title: id,
    venueName: "Venue",
    startTs: "2026-10-01T00:00:00.000Z",
    normalizedEvent: {
      source: "ticketmaster",
      sourceEventId: id,
      title: id,
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
    occurrenceId: id
  };
}

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
      mutations: { retry: false }
    }
  });
  return function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  };
}

describe("useReviewBulkActions", () => {
  it("toggles selection and clears it", () => {
    const { result } = renderHook(
      () =>
        useReviewBulkActions({
          token: "test",
          activeTab: "new",
          items: [candidate("a"), candidate("b")],
          priorityOverrides: {},
          setPriorityOverrides: vi.fn(),
          onAfterDecision: vi.fn()
        }),
      { wrapper: createWrapper() }
    );

    act(() => {
      result.current.handleToggleSelected("a");
      result.current.handleToggleSelected("b");
    });
    expect([...result.current.selectedIds].sort()).toEqual(["a", "b"]);

    act(() => {
      result.current.handleToggleSelected("a");
    });
    expect([...result.current.selectedIds]).toEqual(["b"]);

    act(() => {
      result.current.clearSelection();
    });
    expect(result.current.selectedIds.size).toBe(0);
    expect(result.current.bulkPriority).toBe("");
  });

  it("resets selection and messages when the active tab changes", () => {
    const { result, rerender } = renderHook(
      ({ activeTab }) =>
        useReviewBulkActions({
          token: "test",
          activeTab,
          items: [candidate("a")],
          priorityOverrides: {},
          setPriorityOverrides: vi.fn(),
          onAfterDecision: vi.fn()
        }),
      { initialProps: { activeTab: "new" as const }, wrapper: createWrapper() }
    );

    act(() => {
      result.current.handleToggleSelected("a");
      result.current.setBulkPriority("3");
    });
    expect(result.current.selectedIds.has("a")).toBe(true);
    expect(result.current.bulkPriority).toBe("3");

    act(() => {
      rerender({ activeTab: "updates" });
    });

    expect(result.current.selectedIds.size).toBe(0);
    expect(result.current.bulkPriority).toBe("");
    expect(result.current.approveMessage).toBeNull();
    expect(result.current.deleteMessage).toBeNull();
  });

  it("selects the visible page ids via handleSelectAllPage", () => {
    const { result } = renderHook(
      () =>
        useReviewBulkActions({
          token: "test",
          activeTab: "new",
          items: [candidate("a"), candidate("b"), candidate("c")],
          priorityOverrides: {},
          setPriorityOverrides: vi.fn(),
          onAfterDecision: vi.fn()
        }),
      { wrapper: createWrapper() }
    );

    act(() => {
      result.current.handleSelectAllPage(["b", "c"]);
    });
    expect([...result.current.selectedIds].sort()).toEqual(["b", "c"]);

    act(() => {
      result.current.handleSelectAllPage(["b", "c"]);
    });
    expect(result.current.selectedIds.size).toBe(0);
  });
});
