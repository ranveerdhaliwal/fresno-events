import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useMediaQuery } from "./useMediaQuery";

describe("useMediaQuery", () => {
  const listeners = new Map<string, Set<() => void>>();
  const matchesByQuery = new Map<string, boolean>();

  beforeEach(() => {
    listeners.clear();
    matchesByQuery.clear();
    vi.stubGlobal(
      "matchMedia",
      vi.fn((query: string) => ({
        matches: matchesByQuery.get(query) ?? false,
        media: query,
        addEventListener: (_event: string, listener: () => void) => {
          const set = listeners.get(query) ?? new Set();
          set.add(listener);
          listeners.set(query, set);
        },
        removeEventListener: (_event: string, listener: () => void) => {
          listeners.get(query)?.delete(listener);
        },
        dispatchEvent: () => true
      }))
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  function setQuery(query: string, matches: boolean) {
    matchesByQuery.set(query, matches);
    act(() => {
      for (const listener of listeners.get(query) ?? []) {
        listener();
      }
    });
  }

  it("reads the initial match state from matchMedia", () => {
    matchesByQuery.set("(max-width: 600px)", true);
    const { result } = renderHook(() => useMediaQuery("(max-width: 600px)"));

    expect(result.current).toBe(true);
  });

  it("updates when the media query's match state changes", () => {
    const { result, rerender } = renderHook(() => useMediaQuery("(max-width: 600px)"));
    expect(result.current).toBe(false);

    setQuery("(max-width: 600px)", true);
    rerender();

    expect(result.current).toBe(true);
  });
});
