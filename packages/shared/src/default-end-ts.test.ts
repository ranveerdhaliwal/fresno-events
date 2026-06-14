import { describe, expect, it } from "vitest";

import { resolveEndTs } from "./default-end-ts.js";

describe("resolveEndTs", () => {
  it("defaults to start + 2 hours", () => {
    const end = resolveEndTs("2026-06-05T20:00:00.000Z");
    expect(end).toBe("2026-06-05T22:00:00.000Z");
  });

  it("keeps explicit end", () => {
    expect(resolveEndTs("2026-06-05T20:00:00.000Z", "2026-06-05T23:00:00.000Z")).toBe(
      "2026-06-05T23:00:00.000Z"
    );
  });
});
