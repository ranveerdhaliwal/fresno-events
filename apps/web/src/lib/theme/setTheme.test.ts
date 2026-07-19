import { beforeEach, describe, expect, it } from "vitest";

import { applyInitialTheme } from "./setTheme";

const STORAGE_KEY = "wuf:theme";

describe("applyInitialTheme", () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.dataset.theme = "";
  });

  it("falls back to the provided default when nothing is stored", () => {
    const result = applyInitialTheme("dim");

    expect(result).toBe("dim");
    expect(document.documentElement.dataset.theme).toBe("dim");
  });

  it("uses the stored theme over the default when valid", () => {
    localStorage.setItem(STORAGE_KEY, "light");

    const result = applyInitialTheme("dim");

    expect(result).toBe("light");
    expect(document.documentElement.dataset.theme).toBe("light");
  });

  it("ignores an invalid stored value and falls back to the default", () => {
    localStorage.setItem(STORAGE_KEY, "not-a-theme");

    const result = applyInitialTheme("dim");

    expect(result).toBe("dim");
    expect(document.documentElement.dataset.theme).toBe("dim");
  });
});
