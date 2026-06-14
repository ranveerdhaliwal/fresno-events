import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

describe("EventRow.module.css", () => {
  it("does not paint priority side accent stripes on list rows", () => {
    const css = readFileSync(resolve(__dirname, "EventRow.module.css"), "utf8");

    expect(css).not.toMatch(
      /linear-gradient\(to right, var\(--(mustard|coral|olive|text-label-on-card)\) 0 6px/
    );
  });
});
