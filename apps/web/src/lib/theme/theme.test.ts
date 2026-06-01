import { describe, expect, it } from "vitest";

import { dimTheme } from "./dim.theme";
import { lightTheme } from "./light.theme";

function keysOf<T extends object>(value: T): Array<keyof T> {
  return Object.keys(value) as Array<keyof T>;
}

describe("themes", () => {
  it("dim and light define the same token keys", () => {
    const dimKeys = keysOf(dimTheme).sort();
    const lightKeys = keysOf(lightTheme).sort();
    expect(dimKeys).toEqual(lightKeys);
  });
});

