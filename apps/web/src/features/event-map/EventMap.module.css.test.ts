import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

const cssPath = join(dirname(fileURLToPath(import.meta.url)), "EventMap.module.css");

describe("EventMap.module.css", () => {
  it("uses sticky map + document scroll instead of a fixed viewport shell", () => {
    const css = readFileSync(cssPath, "utf8");
    expect(css).toContain("position: sticky");
    expect(css).not.toMatch(/\.page\s*\{[^}]*max-height:\s*calc\(100dvh/s);
    expect(css).not.toMatch(/\.sidebarList\s*\{[^}]*overflow:\s*auto/s);
  });
});
