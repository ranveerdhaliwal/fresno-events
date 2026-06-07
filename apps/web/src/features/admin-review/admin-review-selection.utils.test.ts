import { describe, expect, it } from "vitest";

import { isPageFullySelected, togglePageSelection } from "./admin-review-selection.utils";

describe("togglePageSelection", () => {
  const fullTab = ["a", "b", "c", "d", "e"];
  const visiblePage = ["b", "c"];

  it("selects only visible page ids without selecting off-page rows", () => {
    const next = togglePageSelection(new Set(), visiblePage);
    expect([...next]).toEqual(["b", "c"]);
    expect(next.has("a")).toBe(false);
    expect(next.has("e")).toBe(false);
  });

  it("merges visible ids into an existing partial selection", () => {
    const next = togglePageSelection(new Set(["a", "b"]), visiblePage);
    expect([...next].sort()).toEqual(["a", "b", "c"]);
  });

  it("deselects visible page ids when all visible are already selected", () => {
    const next = togglePageSelection(new Set(["a", "b", "c", "d"]), visiblePage);
    expect([...next].sort()).toEqual(["a", "d"]);
  });

  it("no-ops deselect when visible page is empty", () => {
    const prev = new Set(fullTab);
    expect(togglePageSelection(prev, [])).toEqual(prev);
  });
});

describe("isPageFullySelected", () => {
  it("is false when only some visible rows are selected", () => {
    expect(isPageFullySelected(new Set(["b"]), ["b", "c"])).toBe(false);
  });

  it("is true when every visible row is selected", () => {
    expect(isPageFullySelected(new Set(["b", "c", "x"]), ["b", "c"])).toBe(true);
  });

  it("is false for an empty page", () => {
    expect(isPageFullySelected(new Set(["a"]), [])).toBe(false);
  });
});
