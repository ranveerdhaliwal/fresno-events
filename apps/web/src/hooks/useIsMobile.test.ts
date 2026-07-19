import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";

import {
  BROWSE_STACK_MEDIA_QUERY,
  MOBILE_MEDIA_QUERY,
  useBrowseEventSelect,
  useIsBrowseStack,
  useIsMobile
} from "./useIsMobile";

const navigate = vi.fn();

vi.mock("@tanstack/react-router", () => ({
  useNavigate: () => navigate
}));

describe("viewport media hooks", () => {
  const listeners = new Map<string, Set<() => void>>();
  const matchesByQuery = new Map<string, boolean>();

  beforeEach(() => {
    listeners.clear();
    matchesByQuery.clear();
    navigate.mockReset();
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

  it("useIsMobile tracks the 600px breakpoint", () => {
    const { result, rerender } = renderHook(() => useIsMobile());
    expect(result.current).toBe(false);

    setQuery(MOBILE_MEDIA_QUERY, true);
    rerender();
    expect(result.current).toBe(true);
  });

  it("useIsBrowseStack tracks the 1080px split collapse", () => {
    const { result, rerender } = renderHook(() => useIsBrowseStack());
    expect(result.current).toBe(false);

    setQuery(BROWSE_STACK_MEDIA_QUERY, true);
    rerender();
    expect(result.current).toBe(true);
  });

  it("useBrowseEventSelect opens detail when the split is stacked", () => {
    const onSelectInSplit = vi.fn();
    const { result, rerender } = renderHook(() => useBrowseEventSelect({ onSelectInSplit }));

    result.current("id-1", "slug-1");
    expect(onSelectInSplit).toHaveBeenCalledWith("id-1");
    expect(navigate).not.toHaveBeenCalled();

    setQuery(BROWSE_STACK_MEDIA_QUERY, true);
    rerender();

    result.current("id-2", "slug-2");
    expect(navigate).toHaveBeenCalledWith({ to: "/event/$slug", params: { slug: "slug-2" } });
  });
});
